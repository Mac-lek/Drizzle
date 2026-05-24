import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma-client/prisma.service';
import { WalletService } from '@wallet/service.wallet';
import { generateId } from '@common/lib/utils/util.id';
import { AdminUserActionDto, AdminKycOverrideDto, AdminWalletCreditDebitDto } from './lib/dto/dto.admin-resource';
import { ok } from '@common/lib/utils/util.response';

@Injectable()
export class AdminResourceService {
  private readonly logger = new Logger(AdminResourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  // ── Users ──────────────────────────────────────────────────────────────────

  async listUsers() {
    const data = await this.prisma.user.findMany({
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
    return ok('Users fetched successfully', data);
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
    return ok('User fetched successfully', user);
  }

  async updateUserStatus(userId: string, dto: AdminUserActionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newStatus = await this.prisma.userStatus.findUnique({ where: { name: dto.status } });
    if (!newStatus) throw new BadRequestException(`Unknown status: ${dto.status}`);

    const data = await this.prisma.user.update({
      where: { id: userId },
      data: { statusId: newStatus.id },
      select: { id: true, status: { select: { name: true } } },
    });
    this.logger.log(`updateUserStatus: user=${userId} status=${dto.status}`);
    return ok('User status updated successfully', data);
  }

  // ── KYC ───────────────────────────────────────────────────────────────────

  async listKycPending() {
    const data = await this.prisma.user.findMany({
      where: { kycStatus: { name: 'PENDING' } },
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
    return ok('KYC records fetched successfully', data);
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
    return ok('User KYC fetched successfully', user);
  }

  async overrideKyc(userId: string, dto: AdminKycOverrideDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newStatus = await this.prisma.kycStatus.findUnique({ where: { name: dto.kycStatus } });
    if (!newStatus) throw new BadRequestException(`Unknown KYC status: ${dto.kycStatus}`);

    const data = await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatusId: newStatus.id },
      select: { id: true, kycStatus: { select: { name: true } } },
    });
    this.logger.log(`overrideKyc: user=${userId} kycStatus=${dto.kycStatus}`);
    return ok('KYC status overridden successfully', data);
  }

  // ── Wallets ───────────────────────────────────────────────────────────────

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, phoneNumber: true } } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = await this.wallets.getBalance(wallet.id);
    return ok('Wallet fetched successfully', { ...wallet, balanceKobo: balance.toString() });
  }

  async creditWallet(userId: string, dto: AdminWalletCreditDebitDto, actorId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const txnId = generateId('txn');
    await this.wallets.credit(wallet.id, BigInt(dto.amountKobo), txnId, dto.description, { creditedBy: actorId });
    this.logger.log(`creditWallet: user=${userId} amountKobo=${dto.amountKobo} actor=${actorId}`);
    return ok('Wallet credited successfully');
  }

  async debitWallet(userId: string, dto: AdminWalletCreditDebitDto, actorId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = await this.wallets.getBalance(wallet.id);
    if (balance < BigInt(dto.amountKobo)) {
      this.logger.warn(`debitWallet: insufficient balance user=${userId} balance=${balance} requested=${dto.amountKobo}`);
      throw new BadRequestException('Insufficient wallet balance');
    }

    const txnId = generateId('txn');
    await this.wallets.debit(wallet.id, BigInt(dto.amountKobo), txnId, dto.description, { debitedBy: actorId });
    this.logger.log(`debitWallet: user=${userId} amountKobo=${dto.amountKobo} actor=${actorId}`);
    return ok('Wallet debited successfully');
  }

  // ── Vaults ────────────────────────────────────────────────────────────────

  async listVaults(userId?: string) {
    const data = await this.prisma.vault.findMany({
      where: userId ? { userId } : undefined,
      include: {
        status: { select: { name: true } },
        frequency: { select: { name: true } },
        user: { select: { id: true, email: true, phoneNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok('Vaults fetched successfully', data);
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
    return ok('Vault fetched successfully', vault);
  }

  async forceBreakVault(vaultId: string) {
    const vault = await this.prisma.vault.findUnique({
      where: { id: vaultId },
      include: { status: { select: { name: true } } },
    });
    if (!vault) throw new NotFoundException('Vault not found');
    if (vault.status.name !== 'ACTIVE') {
      this.logger.warn(`forceBreakVault: vault not active vault=${vaultId} status=${vault.status.name}`);
      throw new BadRequestException('Only active vaults can be force-broken');
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: vault.userId } });
    if (!wallet) throw new NotFoundException('User wallet not found');

    const brokenStatus = await this.prisma.vaultStatus.findUniqueOrThrow({ where: { name: 'BROKEN' } });
    const txnId = generateId('txn');

    const remainingKobo = vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;

    await this.wallets.credit(wallet.id, remainingKobo, txnId, 'Admin force-break: full balance returned', { vaultId });
    await this.prisma.vault.update({
      where: { id: vaultId },
      data: { statusId: brokenStatus.id, brokenAt: new Date() },
    });

    this.logger.log(`forceBreakVault: vault=${vaultId} returnedKobo=${remainingKobo}`);
    return ok('Vault force-broken, balance returned to user wallet');
  }

  // ── Disbursements ─────────────────────────────────────────────────────────

  async listDisbursements(vaultId?: string) {
    const data = await this.prisma.disbursement.findMany({
      where: vaultId ? { vaultId } : undefined,
      include: {
        status: { select: { name: true } },
        vault: { select: { id: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok('Disbursements fetched successfully', data);
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
    return ok('Disbursement fetched successfully', d);
  }

  async retryDisbursement(id: string) {
    const d = await this.prisma.disbursement.findUnique({
      where: { id },
      include: { status: { select: { name: true } } },
    });
    if (!d) throw new NotFoundException('Disbursement not found');
    if (d.status.name !== 'FAILED') {
      this.logger.warn(`retryDisbursement: not failed id=${id} status=${d.status.name}`);
      throw new BadRequestException('Only FAILED disbursements can be retried');
    }

    const pendingStatus = await this.prisma.disbursementStatus.findUniqueOrThrow({ where: { name: 'PENDING' } });
    await this.prisma.disbursement.update({ where: { id }, data: { statusId: pendingStatus.id } });

    this.logger.log(`retryDisbursement: re-queued id=${id}`);
    return ok('Disbursement re-queued for processing');
  }

  // ── Payments (webhook events) ──────────────────────────────────────────────

  async listPayments() {
    const data = await this.prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok('Payments fetched successfully', data);
  }

  async getPayment(id: string) {
    const evt = await this.prisma.webhookEvent.findUnique({ where: { id } });
    if (!evt) throw new NotFoundException('Payment event not found');
    return ok('Payment fetched successfully', evt);
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  async getLedgerEntries(accountId: string) {
    const data = await this.prisma.ledgerEntry.findMany({
      where: { accountId },
      include: {
        accountType: { select: { name: true } },
        direction: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return ok('Ledger entries fetched successfully', data);
  }

  // ── Activity Logs ──────────────────────────────────────────────────────────

  async listAllActivityLogs() {
    const data = await this.prisma.adminActivityLog.findMany({
      include: {
        admin: { select: { id: true, email: true, roleCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return ok('Activity logs fetched successfully', data);
  }
}
