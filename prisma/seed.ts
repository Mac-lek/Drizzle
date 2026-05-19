import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });

async function main() {
  await prisma.dripFrequency.createMany({
    data: [
      { name: 'DAILY', label: 'Daily' },
      { name: 'WEEKLY', label: 'Weekly' },
      { name: 'BIWEEKLY', label: 'Bi-weekly' },
      { name: 'MONTHLY', label: 'Monthly' },
    ],
    skipDuplicates: true,
  });

  await prisma.vaultStatus.createMany({
    data: [
      { name: 'ACTIVE', label: 'Active' },
      { name: 'COMPLETED', label: 'Completed' },
      { name: 'BROKEN', label: 'Broken' },
      { name: 'PAUSED', label: 'Paused' },
    ],
    skipDuplicates: true,
  });

  await prisma.disbursementStatus.createMany({
    data: [
      { name: 'PENDING', label: 'Pending' },
      { name: 'PROCESSING', label: 'Processing' },
      { name: 'COMPLETED', label: 'Completed' },
      { name: 'FAILED', label: 'Failed' },
    ],
    skipDuplicates: true,
  });

  await prisma.accountType.createMany({
    data: [
      { name: 'USER_WALLET', label: 'User Wallet' },
      { name: 'VAULT', label: 'Vault' },
      { name: 'FLOAT_POOL', label: 'Float Pool' },
      { name: 'FEE_REVENUE', label: 'Fee Revenue' },
      { name: 'PENALTY_REVENUE', label: 'Penalty Revenue' },
    ],
    skipDuplicates: true,
  });

  await prisma.entryDirection.createMany({
    data: [
      { name: 'DEBIT', label: 'Debit' },
      { name: 'CREDIT', label: 'Credit' },
    ],
    skipDuplicates: true,
  });

  await prisma.kycStatus.createMany({
    data: [
      { name: 'NONE', label: 'Not Started' },
      { name: 'PENDING', label: 'Pending' },
      { name: 'VERIFIED', label: 'Verified' },
      { name: 'FAILED', label: 'Failed' },
    ],
    skipDuplicates: true,
  });

  await prisma.userStatus.createMany({
    data: [
      { name: 'ACTIVE', label: 'Active' },
      { name: 'INACTIVE', label: 'Inactive' },
      { name: 'BLACKLISTED', label: 'Blacklisted' },
      { name: 'SUSPENDED', label: 'Suspended' },
    ],
    skipDuplicates: true,
  });

  await prisma.tokenType.createMany({
    data: [
      { name: 'OTP', label: 'OTP' },
      { name: 'REFRESH', label: 'Refresh Token' },
      { name: 'PIN_RESET', label: 'PIN Reset' },
    ],
    skipDuplicates: true,
  });

  // ── Admin lookup tables ────────────────────────────────────────────────────

  await prisma.adminStatus.createMany({
    data: [
      { name: 'PENDING',     label: 'Pending' },
      { name: 'ACTIVE',      label: 'Active' },
      { name: 'INACTIVE',    label: 'Inactive' },
      { name: 'SUSPENDED',   label: 'Suspended' },
      { name: 'DEACTIVATED', label: 'Deactivated' },
    ],
    skipDuplicates: true,
  });

  await prisma.adminRoleStatus.createMany({
    data: [
      { name: 'ACTIVE',      label: 'Active' },
      { name: 'DEACTIVATED', label: 'Deactivated' },
    ],
    skipDuplicates: true,
  });

  const activeRoleStatus = await prisma.adminRoleStatus.findUniqueOrThrow({ where: { name: 'ACTIVE' } });

  await prisma.adminRole.createMany({
    data: [
      { code: 'SADM',        name: 'Super Admin',         statusId: activeRoleStatus.id },
      { code: 'COMPLIANCE',  name: 'Compliance Officer',  statusId: activeRoleStatus.id },
      { code: 'SUPPORT',     name: 'Customer Support',    statusId: activeRoleStatus.id },
      { code: 'FINANCE',     name: 'Finance',             statusId: activeRoleStatus.id },
      { code: 'OPS',         name: 'Operations',          statusId: activeRoleStatus.id },
    ],
    skipDuplicates: true,
  });

  await prisma.adminResource.createMany({
    data: [
      { name: 'users',         label: 'Users' },
      { name: 'kyc',           label: 'KYC' },
      { name: 'wallets',       label: 'Wallets' },
      { name: 'vaults',        label: 'Vaults' },
      { name: 'disbursements', label: 'Disbursements' },
      { name: 'payments',      label: 'Payments' },
      { name: 'ledger',        label: 'Ledger' },
      { name: 'admins',        label: 'Admins' },
      { name: 'activity_logs', label: 'Activity Logs' },
    ],
    skipDuplicates: true,
  });

  const resMap = Object.fromEntries(
    (await prisma.adminResource.findMany()).map((r) => [r.name, r.id]),
  );
  const res = (name: string): number => {
    const id = resMap[name];
    if (id === undefined) throw new Error(`Seed: admin resource '${name}' not found`);
    return id;
  };

  const rolePermissions: Array<{ roleCode: string; resourceId: number; permissions: string }> = [
    // SADM — full access (also bypasses checks in code, but seed for completeness)
    { roleCode: 'SADM', resourceId: res('users'),         permissions: 'read,suspend,blacklist' },
    { roleCode: 'SADM', resourceId: res('kyc'),           permissions: 'read,override' },
    { roleCode: 'SADM', resourceId: res('wallets'),       permissions: 'read,credit,debit' },
    { roleCode: 'SADM', resourceId: res('vaults'),        permissions: 'read,force-break' },
    { roleCode: 'SADM', resourceId: res('disbursements'), permissions: 'read,retry' },
    { roleCode: 'SADM', resourceId: res('payments'),      permissions: 'read,refund' },
    { roleCode: 'SADM', resourceId: res('ledger'),        permissions: 'read' },
    { roleCode: 'SADM', resourceId: res('admins'),        permissions: 'read,invite,revoke' },
    { roleCode: 'SADM', resourceId: res('activity_logs'), permissions: 'read' },
    // COMPLIANCE
    { roleCode: 'COMPLIANCE', resourceId: res('users'),         permissions: 'read,suspend,blacklist' },
    { roleCode: 'COMPLIANCE', resourceId: res('kyc'),           permissions: 'read,override' },
    { roleCode: 'COMPLIANCE', resourceId: res('activity_logs'), permissions: 'read' },
    // SUPPORT
    { roleCode: 'SUPPORT', resourceId: res('users'),         permissions: 'read' },
    { roleCode: 'SUPPORT', resourceId: res('wallets'),       permissions: 'read' },
    { roleCode: 'SUPPORT', resourceId: res('vaults'),        permissions: 'read' },
    { roleCode: 'SUPPORT', resourceId: res('disbursements'), permissions: 'read' },
    { roleCode: 'SUPPORT', resourceId: res('payments'),      permissions: 'read' },
    { roleCode: 'SUPPORT', resourceId: res('activity_logs'), permissions: 'read' },
    // FINANCE
    { roleCode: 'FINANCE', resourceId: res('wallets'),       permissions: 'read,credit,debit' },
    { roleCode: 'FINANCE', resourceId: res('ledger'),        permissions: 'read' },
    { roleCode: 'FINANCE', resourceId: res('disbursements'), permissions: 'read,retry' },
    { roleCode: 'FINANCE', resourceId: res('payments'),      permissions: 'read,refund' },
    // OPS
    { roleCode: 'OPS', resourceId: res('disbursements'), permissions: 'read,retry' },
    { roleCode: 'OPS', resourceId: res('vaults'),        permissions: 'read' },
    { roleCode: 'OPS', resourceId: res('activity_logs'), permissions: 'read' },
  ];

  for (const rp of rolePermissions) {
    await prisma.adminRolePermission.upsert({
      where: { roleCode_resourceId: { roleCode: rp.roleCode, resourceId: rp.resourceId } },
      create: rp,
      update: { permissions: rp.permissions },
    });
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
