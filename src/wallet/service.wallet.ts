import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Wallet } from "@prisma/client";
import { PrismaService } from "@prisma-client/prisma.service";
import { LedgerService } from "@ledger/service.ledger";

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      this.logger.warn(`findByUserId: wallet not found user=${userId}`);
      throw new NotFoundException("Wallet not found");
    }
    return wallet;
  }

  async getBalance(walletId: string): Promise<bigint> {
    return this.ledger.getBalance(walletId, "USER_WALLET");
  }

  async credit(
    walletId: string,
    amountKobo: bigint,
    transactionId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.ledger.record(transactionId, [
      {
        accountId: walletId,
        accountType: "USER_WALLET",
        direction: "CREDIT",
        amountKobo,
        description,
        metadata,
      },
    ]);
    this.logger.log(`credit: wallet=${walletId} amountKobo=${amountKobo} txn=${transactionId}`);
  }

  async debit(
    walletId: string,
    amountKobo: bigint,
    transactionId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.ledger.record(transactionId, [
      {
        accountId: walletId,
        accountType: "USER_WALLET",
        direction: "DEBIT",
        amountKobo,
        description,
        metadata,
      },
    ]);
    this.logger.log(`debit: wallet=${walletId} amountKobo=${amountKobo} txn=${transactionId}`);
  }
}
