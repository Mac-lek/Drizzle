import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { VaultService } from "./service.vault";
import { PrismaService } from "@prisma-client/prisma.service";
import { WalletService } from "@wallet/service.wallet";

const mockWallet = { id: "wlt_1", userId: "usr_1" };

const mockVault = {
  id: "vlt_1",
  userId: "usr_1",
  lockedAmountKobo: BigInt(100000),
  trancheAmountKobo: BigInt(10000),
  tranchesSent: 2,
  status: { name: "ACTIVE" },
  frequency: { name: "MONTHLY" },
};

const mockTx = {
  $queryRaw: jest.fn().mockResolvedValue([]),
  accountType: { findUniqueOrThrow: jest.fn() },
  entryDirection: { findUniqueOrThrow: jest.fn() },
  ledgerEntry: { aggregate: jest.fn(), createMany: jest.fn() },
  vault: { create: jest.fn(), update: jest.fn() },
};

const mockPrisma = {
  vault: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  dripFrequency: { findUniqueOrThrow: jest.fn() },
  vaultStatus: { findUniqueOrThrow: jest.fn() },
  $transaction: jest.fn(),
};

const mockWallets = {
  findByUserId: jest.fn(),
};

describe("VaultService", () => {
  let service: VaultService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWallets },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
  });

  describe("create", () => {
    it("throws BadRequestException when startsAt is in the past", async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await expect(
        service.create("usr_1", {
          name: "Test",
          lockedAmountKobo: 10000,
          totalTranches: 5,
          frequency: "MONTHLY",
          startsAt: past,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException on insufficient balance", async () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      mockWallets.findByUserId.mockResolvedValue(mockWallet);
      mockPrisma.dripFrequency.findUniqueOrThrow.mockResolvedValue({ id: 1 });
      mockPrisma.vaultStatus.findUniqueOrThrow.mockResolvedValue({ id: 1 });

      mockTx.accountType.findUniqueOrThrow.mockResolvedValue({ id: 1 });
      mockTx.entryDirection.findUniqueOrThrow.mockResolvedValue({ id: 10 });
      mockTx.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amountKobo: BigInt(5000) } }) // credits
        .mockResolvedValueOnce({ _sum: { amountKobo: BigInt(0) } }); // debits

      mockPrisma.$transaction.mockImplementation((fn) => fn(mockTx));

      await expect(
        service.create("usr_1", {
          name: "Test",
          lockedAmountKobo: 100000,
          totalTranches: 5,
          frequency: "MONTHLY",
          startsAt: future,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when vault does not exist", async () => {
      mockPrisma.vault.findUnique.mockResolvedValue(null);
      await expect(service.findById("vlt_x", "usr_1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when vault belongs to another user", async () => {
      mockPrisma.vault.findUnique.mockResolvedValue({
        ...mockVault,
        userId: "usr_other",
      });
      await expect(service.findById("vlt_1", "usr_1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("returns vault when user matches", async () => {
      mockPrisma.vault.findUnique.mockResolvedValue(mockVault);
      const result = await service.findById("vlt_1", "usr_1");
      expect(result).toEqual(mockVault);
    });
  });

  describe("findByUser", () => {
    it("returns all vaults for a user", async () => {
      mockPrisma.vault.findMany.mockResolvedValue([mockVault]);
      const result = await service.findByUser("usr_1");
      expect(result).toHaveLength(1);
      expect(mockPrisma.vault.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "usr_1" } }),
      );
    });
  });

  describe("breakVault", () => {
    it("throws BadRequestException when vault is not ACTIVE", async () => {
      mockPrisma.vault.findUnique.mockResolvedValue({
        ...mockVault,
        status: { name: "COMPLETED" },
      });
      await expect(service.breakVault("usr_1", "vlt_1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("applies 10% penalty on remaining balance and updates vault", async () => {
      mockPrisma.vault.findUnique.mockResolvedValue(mockVault);
      mockPrisma.vaultStatus.findUniqueOrThrow.mockResolvedValue({ id: 3 });
      mockWallets.findByUserId.mockResolvedValue(mockWallet);

      mockTx.accountType.findUniqueOrThrow.mockResolvedValue({ id: 1 });
      mockTx.entryDirection.findUniqueOrThrow.mockResolvedValue({ id: 10 });
      mockTx.ledgerEntry.createMany.mockResolvedValue({ count: 4 });
      mockTx.vault.update.mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation((fn) => fn(mockTx));
      mockPrisma.vault.findUniqueOrThrow.mockResolvedValue({
        ...mockVault,
        status: { name: "BROKEN" },
      });

      const result = await service.breakVault("usr_1", "vlt_1");

      expect(mockTx.vault.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statusId: 3 }),
        }),
      );
      expect(result.status.name).toBe("BROKEN");
    });
  });
});
