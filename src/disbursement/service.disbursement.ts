import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { generateId } from '@common/lib/utils/util.id';

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findDueVaults(): Promise<Array<{
    id: string;
    tranchesSent: number;
    totalTranches: number;
    startsAt: Date;
    frequency: { name: string };
  }>> {
    const now = new Date();
    const activeStatus = await this.prisma.vaultStatus.findUniqueOrThrow({ where: { name: 'ACTIVE' } });

    const vaults = await this.prisma.vault.findMany({
      where: { statusId: activeStatus.id, startsAt: { lte: now } },
      select: {
        id: true,
        tranchesSent: true,
        totalTranches: true,
        startsAt: true,
        frequency: { select: { name: true } },
      },
    });

    return vaults.filter((v) => {
      if (v.tranchesSent >= v.totalTranches) return false;
      return this.computeNextDripAt(v.startsAt, v.tranchesSent, v.frequency.name) <= now;
    });
  }

  async processDrip(vaultId: string): Promise<void> {
    const vault = await this.prisma.vault.findUnique({
      where: { id: vaultId },
      include: {
        frequency: { select: { name: true } },
        status: { select: { name: true } },
      },
    });

    if (!vault || vault.status.name !== 'ACTIVE') return;
    if (vault.tranchesSent >= vault.totalTranches) return;

    const now = new Date();
    const nextDripAt = this.computeNextDripAt(vault.startsAt, vault.tranchesSent, vault.frequency.name);
    if (nextDripAt > now) return;

    const dripNumber = vault.tranchesSent + 1;
    const isLastTranche = dripNumber === vault.totalTranches;
    const trancheAmountKobo = isLastTranche
      ? vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo
      : vault.trancheAmountKobo;

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId: vault.userId } });
    const disbursementId = generateId('dsb');
    const transactionId = generateId('txn');

    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.disbursement.findUnique({
          where: { vaultId_dripNumber: { vaultId, dripNumber } },
          include: { status: { select: { name: true } } },
        });

        if (existing?.status.name === 'COMPLETED') return;

        const [processingStatus, completedDisbStatus, completedVaultStatus, debitDir, creditDir, vaultType, walletType] =
          await Promise.all([
            tx.disbursementStatus.findUniqueOrThrow({ where: { name: 'PROCESSING' } }),
            tx.disbursementStatus.findUniqueOrThrow({ where: { name: 'COMPLETED' } }),
            tx.vaultStatus.findUniqueOrThrow({ where: { name: 'COMPLETED' } }),
            tx.entryDirection.findUniqueOrThrow({ where: { name: 'DEBIT' } }),
            tx.entryDirection.findUniqueOrThrow({ where: { name: 'CREDIT' } }),
            tx.accountType.findUniqueOrThrow({ where: { name: 'VAULT' } }),
            tx.accountType.findUniqueOrThrow({ where: { name: 'USER_WALLET' } }),
          ]);

        const disbId = existing?.id ?? disbursementId;

        if (!existing) {
          await tx.disbursement.create({
            data: {
              id: disbId,
              vaultId,
              userId: vault.userId,
              dripNumber,
              amountKobo: trancheAmountKobo,
              statusId: processingStatus.id,
              attemptedAt: now,
            },
          });
        } else {
          await tx.disbursement.update({
            where: { id: disbId },
            data: { statusId: processingStatus.id, attemptedAt: now },
          });
        }

        await tx.ledgerEntry.createMany({
          data: [
            {
              id: generateId('led'),
              transactionId,
              accountId: vaultId,
              accountTypeId: vaultType.id,
              directionId: debitDir.id,
              amountKobo: trancheAmountKobo,
              description: `Vault drip #${dripNumber} disbursed`,
            },
            {
              id: generateId('led'),
              transactionId,
              accountId: wallet.id,
              accountTypeId: walletType.id,
              directionId: creditDir.id,
              amountKobo: trancheAmountKobo,
              description: `Vault drip #${dripNumber} received`,
            },
          ],
        });

        const newTranchesSent = vault.tranchesSent + 1;
        await tx.vault.update({
          where: { id: vaultId },
          data: {
            tranchesSent: newTranchesSent,
            ...(newTranchesSent === vault.totalTranches && { statusId: completedVaultStatus.id }),
          },
        });

        await tx.disbursement.update({
          where: { id: disbId },
          data: { statusId: completedDisbStatus.id, completedAt: new Date() },
        });
      });

      this.logger.log({ vaultId, dripNumber }, 'Drip processed successfully');
    } catch (error) {
      this.logger.error({ vaultId, dripNumber, error }, 'Drip processing failed');

      const failedStatus = await this.prisma.disbursementStatus.findUniqueOrThrow({ where: { name: 'FAILED' } });
      await this.prisma.disbursement.upsert({
        where: { vaultId_dripNumber: { vaultId, dripNumber } },
        create: {
          id: disbursementId,
          vaultId,
          userId: vault.userId,
          dripNumber,
          amountKobo: trancheAmountKobo,
          statusId: failedStatus.id,
          attemptedAt: now,
          failReason: (error as Error).message,
        },
        update: {
          statusId: failedStatus.id,
          failReason: (error as Error).message,
        },
      });

      throw error;
    }
  }

  private computeNextDripAt(startsAt: Date, tranchesSent: number, frequency: string): Date {
    const d = new Date(startsAt);
    const n = tranchesSent;
    switch (frequency) {
      case 'DAILY':    d.setDate(d.getDate() + n); break;
      case 'WEEKLY':   d.setDate(d.getDate() + n * 7); break;
      case 'BIWEEKLY': d.setDate(d.getDate() + n * 14); break;
      case 'MONTHLY':  d.setMonth(d.getMonth() + n); break;
    }
    return d;
  }
}
