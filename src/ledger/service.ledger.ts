import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { generateId } from '@common/lib/utils/util.id';

export interface LedgerEntryInput {
  accountId: string;
  accountType: string;
  direction: 'DEBIT' | 'CREDIT';
  amountKobo: bigint;
  description: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LedgerService {
  private readonly accountTypeIds = new Map<string, number>();
  private readonly directionIds = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async record(transactionId: string, entries: LedgerEntryInput[]): Promise<void> {
    const creates = await Promise.all(
      entries.map(async (e) => ({
        id: generateId('led'),
        transactionId,
        accountId: e.accountId,
        amountKobo: e.amountKobo,
        description: e.description,
        metadata: e.metadata as Prisma.InputJsonValue | undefined,
        accountTypeId: await this.resolveAccountTypeId(e.accountType),
        directionId: await this.resolveDirectionId(e.direction),
      })),
    );

    await this.prisma.ledgerEntry.createMany({ data: creates });
  }

  async getBalance(accountId: string, accountType: string): Promise<bigint> {
    const accountTypeId = await this.resolveAccountTypeId(accountType);
    const [creditId, debitId] = await Promise.all([
      this.resolveDirectionId('CREDIT'),
      this.resolveDirectionId('DEBIT'),
    ]);

    const [credits, debits] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { accountId, accountTypeId, directionId: creditId },
        _sum: { amountKobo: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { accountId, accountTypeId, directionId: debitId },
        _sum: { amountKobo: true },
      }),
    ]);

    return (credits._sum.amountKobo ?? BigInt(0)) - (debits._sum.amountKobo ?? BigInt(0));
  }

  private async resolveAccountTypeId(name: string): Promise<number> {
    if (!this.accountTypeIds.has(name)) {
      const type = await this.prisma.accountType.findUniqueOrThrow({ where: { name } });
      this.accountTypeIds.set(name, type.id);
    }
    return this.accountTypeIds.get(name)!;
  }

  private async resolveDirectionId(name: string): Promise<number> {
    if (!this.directionIds.has(name)) {
      const dir = await this.prisma.entryDirection.findUniqueOrThrow({ where: { name } });
      this.directionIds.set(name, dir.id);
    }
    return this.directionIds.get(name)!;
  }
}
