import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      { name: 'TIER_1_PENDING', label: 'Tier 1 Pending' },
      { name: 'TIER_1_VERIFIED', label: 'Tier 1 Verified' },
      { name: 'TIER_2_PENDING', label: 'Tier 2 Pending' },
      { name: 'TIER_2_VERIFIED', label: 'Tier 2 Verified' },
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

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
