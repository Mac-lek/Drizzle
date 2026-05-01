import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { WalletService } from '@wallet/service.wallet';
import { generateId } from '@common/lib/utils/util.id';
import { CreateVaultDto } from './lib/dto/dto.vault.create';

const BREAK_PENALTY_RATE = 0.1;
const PLATFORM_ACCOUNT_ID = 'drizzle_platform';

const vaultInclude = {
  frequency: { select: { name: true } },
  status: { select: { name: true } },
} satisfies Prisma.VaultInclude;

export type VaultWithRelations = Prisma.VaultGetPayload<{ include: typeof vaultInclude }>;

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  async create(userId: string, dto: CreateVaultDto): Promise<VaultWithRelations> {
    const lockedAmountKobo = BigInt(dto.lockedAmountKobo);
    const totalTranches = dto.totalTranches;

    // BigInt division floors automatically; the last tranche absorbs the remainder.
    const trancheAmountKobo = lockedAmountKobo / BigInt(totalTranches);

    const startsAt = new Date(dto.startsAt);
    if (startsAt <= new Date()) {
      throw new BadRequestException('startsAt must be in the future');
    }

    const wallet = await this.wallets.findByUserId(userId);

    const [frequency, activeStatus] = await Promise.all([
      this.prisma.dripFrequency.findUniqueOrThrow({ where: { name: dto.frequency } }),
      this.prisma.vaultStatus.findUniqueOrThrow({ where: { name: 'ACTIVE' } }),
    ]);

    const endsAt = this.computeEndsAt(startsAt, dto.frequency, totalTranches);
    const vaultId = generateId('vlt');
    const transactionId = generateId('txn');

    await this.prisma.$transaction(async (tx) => {
      // Lock the wallet row so concurrent vault creates for the same wallet are serialized.
      await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`;

      const [debitId, creditId, walletTypeId, vaultTypeId] = await Promise.all([
        this.resolveDirectionId(tx, 'DEBIT'),
        this.resolveDirectionId(tx, 'CREDIT'),
        this.resolveAccountTypeId(tx, 'USER_WALLET'),
        this.resolveAccountTypeId(tx, 'VAULT'),
      ]);

      const [credits, debits] = await Promise.all([
        tx.ledgerEntry.aggregate({
          where: { accountId: wallet.id, accountTypeId: walletTypeId, directionId: creditId },
          _sum: { amountKobo: true },
        }),
        tx.ledgerEntry.aggregate({
          where: { accountId: wallet.id, accountTypeId: walletTypeId, directionId: debitId },
          _sum: { amountKobo: true },
        }),
      ]);

      const balance =
        (credits._sum.amountKobo ?? BigInt(0)) - (debits._sum.amountKobo ?? BigInt(0));

      if (balance < lockedAmountKobo) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await tx.vault.create({
        data: {
          id: vaultId,
          userId,
          name: dto.name,
          lockedAmountKobo,
          trancheAmountKobo,
          totalTranches,
          startsAt,
          endsAt,
          frequencyId: frequency.id,
          statusId: activeStatus.id,
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            id: generateId('led'),
            transactionId,
            accountId: wallet.id,
            accountTypeId: walletTypeId,
            directionId: debitId,
            amountKobo: lockedAmountKobo,
            description: 'Vault lock: funds moved from wallet',
          },
          {
            id: generateId('led'),
            transactionId,
            accountId: vaultId,
            accountTypeId: vaultTypeId,
            directionId: creditId,
            amountKobo: lockedAmountKobo,
            description: 'Vault lock: funds received',
          },
        ],
      });
    });

    return this.prisma.vault.findUniqueOrThrow({ where: { id: vaultId }, include: vaultInclude });
  }

  async findById(id: string, userId: string): Promise<VaultWithRelations> {
    const vault = await this.prisma.vault.findUnique({ where: { id }, include: vaultInclude });
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.userId !== userId) throw new ForbiddenException();
    return vault;
  }

  async findByUser(userId: string): Promise<VaultWithRelations[]> {
    return this.prisma.vault.findMany({
      where: { userId },
      include: vaultInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async breakVault(userId: string, vaultId: string): Promise<VaultWithRelations> {
    const vault = await this.findById(vaultId, userId);

    if (vault.status.name !== 'ACTIVE') {
      throw new BadRequestException('Only active vaults can be broken');
    }

    const brokenStatus = await this.prisma.vaultStatus.findUniqueOrThrow({
      where: { name: 'BROKEN' },
    });

    const remainingKobo =
      vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;
    const penaltyKobo =
      (remainingKobo * BigInt(Math.round(BREAK_PENALTY_RATE * 1000))) / BigInt(1000);
    const returnKobo = remainingKobo - penaltyKobo;

    const wallet = await this.wallets.findByUserId(userId);
    const transactionId = generateId('txn');

    await this.prisma.$transaction(async (tx) => {
      const [debitId, creditId, vaultTypeId, walletTypeId, penaltyTypeId] = await Promise.all([
        this.resolveDirectionId(tx, 'DEBIT'),
        this.resolveDirectionId(tx, 'CREDIT'),
        this.resolveAccountTypeId(tx, 'VAULT'),
        this.resolveAccountTypeId(tx, 'USER_WALLET'),
        this.resolveAccountTypeId(tx, 'PENALTY_REVENUE'),
      ]);

      await tx.ledgerEntry.createMany({
        data: [
          {
            id: generateId('led'),
            transactionId,
            accountId: vaultId,
            accountTypeId: vaultTypeId,
            directionId: debitId,
            amountKobo: returnKobo,
            description: 'Vault break: return to wallet',
          },
          {
            id: generateId('led'),
            transactionId,
            accountId: wallet.id,
            accountTypeId: walletTypeId,
            directionId: creditId,
            amountKobo: returnKobo,
            description: 'Vault break: funds returned',
          },
          {
            id: generateId('led'),
            transactionId,
            accountId: vaultId,
            accountTypeId: vaultTypeId,
            directionId: debitId,
            amountKobo: penaltyKobo,
            description: 'Vault break: penalty',
          },
          {
            id: generateId('led'),
            transactionId,
            accountId: PLATFORM_ACCOUNT_ID,
            accountTypeId: penaltyTypeId,
            directionId: creditId,
            amountKobo: penaltyKobo,
            description: 'Vault break penalty revenue',
          },
        ],
      });

      await tx.vault.update({
        where: { id: vaultId },
        data: { statusId: brokenStatus.id, brokenAt: new Date(), penaltyKobo },
      });
    });

    return this.prisma.vault.findUniqueOrThrow({ where: { id: vaultId }, include: vaultInclude });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private computeEndsAt(startsAt: Date, frequency: string, totalTranches: number): Date {
    const end = new Date(startsAt);
    const n = totalTranches - 1;
    switch (frequency) {
      case 'DAILY':    end.setDate(end.getDate() + n); break;
      case 'WEEKLY':   end.setDate(end.getDate() + n * 7); break;
      case 'BIWEEKLY': end.setDate(end.getDate() + n * 14); break;
      case 'MONTHLY':  end.setMonth(end.getMonth() + n); break;
    }
    return end;
  }

  private async resolveAccountTypeId(
    tx: Prisma.TransactionClient,
    name: string,
  ): Promise<number> {
    const type = await tx.accountType.findUniqueOrThrow({ where: { name } });
    return type.id;
  }

  private async resolveDirectionId(
    tx: Prisma.TransactionClient,
    name: string,
  ): Promise<number> {
    const dir = await tx.entryDirection.findUniqueOrThrow({ where: { name } });
    return dir.id;
  }
}
