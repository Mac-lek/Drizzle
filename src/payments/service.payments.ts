import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { generateId } from '@common/lib/utils/util.id';
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
    private readonly config: ConfigService,
  ) {}

  async initializeFunding(
    userId: string,
    dto: FundDto,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    const user = await this.users.findById(userId);
    if (!user!.email) {
      throw new BadRequestException('Please complete your profile before funding your wallet.');
    }

    const wallet = await this.wallets.findByUserId(userId);
    const reference = randomUUID();
    const email = user!.email;

    const result = await this.paystack.initializeTransaction({
      email,
      amount: dto.amountKobo,
      reference,
      metadata: { userId, walletId: wallet.id },
      callback_url: undefined,
    });

    return { authorizationUrl: result.authorization_url, reference };
  }

  async setupWalletCustomer(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.email) {
      throw new BadRequestException('Please complete your profile before setting up payments.');
    }

    const wallet = await this.wallets.findByUserId(userId);

    if (wallet.paystackCustomerCode) return; // already set up — idempotent

    const customer = await this.paystack.createCustomer({
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      phone: user.phoneNumber ?? undefined,
    });

    const preferredBank = this.config.get<string>('PAYSTACK_PREFERRED_BANK', 'wema-bank');
    const dva = await this.paystack.createDedicatedVirtualAccount(
      customer.customer_code,
      preferredBank,
    );

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        paystackCustomerCode: customer.customer_code,
        paystackVirtualAcctNo: dva.account_number,
        paystackVirtualBankName: dva.bank.name,
      },
    });
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
        id: generateId('evt'),
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
