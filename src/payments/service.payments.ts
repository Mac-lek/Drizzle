import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@prisma-client/prisma.service';
import { UsersService } from '@users/service.users';
import { WalletService } from '@wallet/service.wallet';
import { PaystackProvider } from './providers/paystack.provider';
import { FundDto } from './lib/dto/dto.payments.fund';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly wallets: WalletService,
    private readonly paystack: PaystackProvider,
  ) {}

  async initializeFunding(
    userId: string,
    dto: FundDto,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    const user = await this.users.findById(userId);
    const wallet = await this.wallets.findByUserId(userId);
    const reference = randomUUID();
    const email = user!.email ?? `${userId}@drizzle.ng`;

    const result = await this.paystack.initializeTransaction({
      email,
      amount: dto.amountKobo,
      reference,
      metadata: { userId, walletId: wallet.id },
      callback_url: undefined,
    });

    return { authorizationUrl: result.authorization_url, reference };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.paystack.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString()) as {
      event: string;
      data: {
        reference: string;
        status: string;
        amount: number;
        channel: string;
        metadata?: { userId?: string; walletId?: string };
      };
    };

    const { event, data } = payload;
    const eventId = data.reference;

    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existing?.processed) return;

    await this.prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        provider: 'paystack',
        eventId,
        eventType: event,
        payload: payload as object,
      },
      update: {},
    });

    if (event === 'charge.success' && data.status === 'success') {
      const { userId, walletId } = data.metadata ?? {};
      if (!userId || !walletId) {
        this.logger.warn({ eventId }, 'charge.success missing metadata — skipping credit');
        return;
      }

      await this.wallets.credit(
        walletId,
        BigInt(data.amount),
        eventId,
        'Wallet funding via Paystack',
        { paystackReference: eventId, channel: data.channel },
      );

      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { processed: true, processedAt: new Date() },
      });
    }
  }
}
