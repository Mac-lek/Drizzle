import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma-client/prisma.service';
import { WalletService } from '@wallet/service.wallet';
import { generateId } from '@common/lib/utils/util.id';
import { AdminUserActionDto, AdminKycOverrideDto, AdminWalletCreditDebitDto } from './lib/dto/dto.admin-resource';

@Injectable()
export class AdminResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  // ── Users ──────────────────────────────────────────────────────────────────

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        bvnVerified: true,
        status: { select: { name: true } },
        kycStatus: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        status: { select: { name: true } },
        kycStatus: { select: { name: true } },
        wallet: { select: { id: true, paystackCustomerCode: true, paystackVirtualAcctNo: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserStatus(userId: string, dto: AdminUserActionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newStatus = await this.prisma.userStatus.findUnique({ where: { name: dto.status } });
    if (!newStatus) throw new BadRequestException(`Unknown status: ${dto.status}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { statusId: newStatus.id },
      select: { id: true, status: { select: { name: true } } },
    });
  }

  // ── KYC ───────────────────────────────────────────────────────────────────

  async listKycPending() {
    return this.prisma.user.findMany({
      where: { kycStatus: { name: { in: ['TIER_1_PENDING', 'TIER_2_PENDING'] } } },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        bvnVerified: true,
        kycStatus: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUserKyc(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        bvnVerified: true,
        kycStatus: { select: { name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async overrideKyc(userId: string, dto: AdminKycOverrideDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newStatus = await this.prisma.kycStatus.findUnique({ where: { name: dto.kycStatus } });
    if (!newStatus) throw new BadRequestException(`Unknown KYC status: ${dto.kycStatus}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { kycStatusId: newStatus.id },
      select: { id: true, kycStatus: { select: { name: true } } },
    });
  }

  // ── Wallets ───────────────────────────────────────────────────────────────

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, phoneNumber: true } } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = await this.wallets.getBalance(wallet.id);
    return { ...wallet, balanceKobo: balance.toString() };
  }

  async creditWallet(userId: string, dto: AdminWalletCreditDebitDto, actorId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const txnId = generateId('txn');
    await this.wallets.credit(wallet.id, BigInt(dto.amountKobo), txnId, dto.description, { creditedBy: actorId });
    return { message: 'Wallet credited successfully' };
  }

  async debitWallet(userId: string, dto: AdminWalletCreditDebitDto, actorId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = await this.wallets.getBalance(wallet.id);
    if (balance < BigInt(dto.amountKobo)) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const txnId = generateId('txn');
    await this.wallets.debit(wallet.id, BigInt(dto.amountKobo), txnId, dto.description, { debitedBy: actorId });
    return { message: 'Wallet debited successfully' };
  }

  // ── Vaults ────────────────────────────────────────────────────────────────

  async listVaults(userId?: string) {
    return this.prisma.vault.findMany({
      where: userId ? { userId } : undefined,
      include: {
        status: { select: { name: true } },
        frequency: { select: { name: true } },
        user: { select: { id: true, email: true, phoneNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVault(vaultId: string) {
    const vault = await this.prisma.vault.findUnique({
      where: { id: vaultId },
      include: {
        status: { select: { name: true } },
        frequency: { select: { name: true } },
        user: { select: { id: true, email: true, phoneNumber: true } },
        disbursements: { include: { status: { select: { name: true } } }, orderBy: { dripNumber: 'asc' } },
      },
    });
    if (!vault) throw new NotFoundException('Vault not found');
    return vault;
  }

  async forceBreakVault(vaultId: string) {
    const vault = await this.prisma.vault.findUnique({
      where: { id: vaultId },
      include: { status: { select: { name: true } } },
    });
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.status.name !== 'ACTIVE') throw new BadRequestException('Only active vaults can be force-broken');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: vault.userId } });
    if (!wallet) throw new NotFoundException('User wallet not found');

    const brokenStatus = await this.prisma.vaultStatus.findUniqueOrThrow({ where: { name: 'BROKEN' } });
    const txnId = generateId('txn');

    // Return full remaining balance — no penalty for force-break
    const remainingKobo = vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;

    await this.wallets.credit(wallet.id, remainingKobo, txnId, 'Admin force-break: full balance returned', { vaultId });
    await this.prisma.vault.update({
      where: { id: vaultId },
      data: { statusId: brokenStatus.id, brokenAt: new Date() },
    });

    return { message: 'Vault force-broken, balance returned to user wallet' };
  }

  // ── Disbursements ─────────────────────────────────────────────────────────

  async listDisbursements(vaultId?: string) {
    return this.prisma.disbursement.findMany({
      where: vaultId ? { vaultId } : undefined,
      include: {
        status: { select: { name: true } },
        vault: { select: { id: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getDisbursement(id: string) {
    const d = await this.prisma.disbursement.findUnique({
      where: { id },
      include: {
        status: { select: { name: true } },
        vault: { include: { user: { select: { id: true, email: true, phoneNumber: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Disbursement not found');
    return d;
  }

  async retryDisbursement(id: string) {
    const d = await this.prisma.disbursement.findUnique({
      where: { id },
      include: { status: { select: { name: true } } },
    });
    if (!d) throw new NotFoundException('Disbursement not found');
    if (d.status.name !== 'FAILED') throw new BadRequestException('Only FAILED disbursements can be retried');

    const pendingStatus = await this.prisma.disbursementStatus.findUniqueOrThrow({ where: { name: 'PENDING' } });
    await this.prisma.disbursement.update({ where: { id }, data: { statusId: pendingStatus.id } });

    return { message: 'Disbursement re-queued for processing' };
  }

  // ── Payments (webhook events) ──────────────────────────────────────────────

  async listPayments() {
    return this.prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getPayment(id: string) {
    const evt = await this.prisma.webhookEvent.findUnique({ where: { id } });
    if (!evt) throw new NotFoundException('Payment event not found');
    return evt;
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  async getLedgerEntries(accountId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { accountId },
      include: {
        accountType: { select: { name: true } },
        direction: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // ── Activity Logs ──────────────────────────────────────────────────────────

  async listAllActivityLogs() {
    return this.prisma.adminActivityLog.findMany({
      include: {
        admin: { select: { id: true, email: true, roleCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
