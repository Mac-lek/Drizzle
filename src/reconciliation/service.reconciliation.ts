import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@prisma-client/prisma.service';
import { WalletService } from '@wallet/service.wallet';
import { PaystackProvider } from '@payments/providers/paystack.provider';

const WEBHOOK_GRACE_MINUTES = 5;
const STUCK_PROCESSING_MINUTES = 10;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly paystack: PaystackProvider,
  ) {}

  /**
   * Re-verify unprocessed Paystack charge.success events that the webhook
   * handler may have missed (delivery failure, server restart, etc.).
   * Runs every 30 minutes. Skips events younger than WEBHOOK_GRACE_MINUTES
   * to avoid racing with the live webhook handler.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcilePaystackWebhooks(): Promise<void> {
    const cutoff = new Date(Date.now() - WEBHOOK_GRACE_MINUTES * 60 * 1000);

    const pending = await this.prisma.webhookEvent.findMany({
      where: {
        provider: 'paystack',
        eventType: 'charge.success',
        processed: false,
        createdAt: { lt: cutoff },
      },
    });

    if (!pending.length) return;

    this.logger.log(`Reconciling ${pending.length} unprocessed Paystack event(s)`);

    for (const event of pending) {
      try {
        const tx = await this.paystack.verifyTransaction(event.eventId);

        if (tx.status !== 'success') {
          this.logger.warn({ eventId: event.eventId }, 'Paystack verification: not success — skipping');
          continue;
        }

        const payload = event.payload as {
          data?: { metadata?: { userId?: string; walletId?: string }; channel?: string };
        };
        const { userId, walletId } = payload.data?.metadata ?? {};

        if (!userId || !walletId) {
          this.logger.warn({ eventId: event.eventId }, 'Missing metadata in stored payload — skipping');
          continue;
        }

        await this.wallets.credit(
          walletId,
          BigInt(tx.amount),
          event.eventId,
          'Wallet funding via Paystack (reconciled)',
          { paystackReference: event.eventId, channel: payload.data?.channel, reconciled: true },
        );

        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { processed: true, processedAt: new Date() },
        });

        this.logger.log({ eventId: event.eventId, walletId }, 'Reconciled Paystack event');
      } catch (err) {
        this.logger.error({ eventId: event.eventId, err }, 'Failed to reconcile Paystack event');
      }
    }
  }

  /**
   * Reset disbursements stuck in PROCESSING back to PENDING so the BullMQ
   * processor retries them. Guards against a worker crash mid-job.
   * Runs every 15 minutes.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileStuckDisbursements(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000);

    const processingStatus = await this.prisma.disbursementStatus.findUniqueOrThrow({
      where: { name: 'PROCESSING' },
    });
    const pendingStatus = await this.prisma.disbursementStatus.findUniqueOrThrow({
      where: { name: 'PENDING' },
    });

    const stuck = await this.prisma.disbursement.updateMany({
      where: {
        statusId: processingStatus.id,
        updatedAt: { lt: cutoff },
      },
      data: { statusId: pendingStatus.id },
    });

    if (stuck.count > 0) {
      this.logger.warn(`Reset ${stuck.count} stuck PROCESSING disbursement(s) to PENDING`);
    }
  }
}
