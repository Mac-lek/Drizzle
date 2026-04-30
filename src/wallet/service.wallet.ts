import { Injectable, NotFoundException } from '@nestjs/common';
import { Wallet } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { LedgerService } from '@ledger/service.ledger';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getBalance(walletId: string): Promise<bigint> {
    return this.ledger.getBalance(walletId, 'USER_WALLET');
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
        accountType: 'USER_WALLET',
        direction: 'CREDIT',
        amountKobo,
        description,
        metadata,
      },
    ]);
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
        accountType: 'USER_WALLET',
        direction: 'DEBIT',
        amountKobo,
        description,
        metadata,
      },
    ]);
  }
}
