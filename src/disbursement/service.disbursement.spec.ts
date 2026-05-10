import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { DisbursementService } from "./service.disbursement";
import { PrismaService } from "@prisma-client/prisma.service";

const mockDisbursement = {
  id: "dsb_abc123",
  vaultId: "vlt_vault1",
  dripNumber: 1,
  amountKobo: BigInt(50000),
  status: { name: "COMPLETED" },
  failReason: null,
  attemptedAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-01T00:00:01Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("DisbursementService", () => {
  let service: DisbursementService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisbursementService,
        {
          provide: PrismaService,
          useValue: {
            disbursement: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
            },
            vault: { findMany: jest.fn() },
            vaultStatus: { findUniqueOrThrow: jest.fn() },
            disbursementStatus: { findUniqueOrThrow: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(DisbursementService);
    prisma = module.get(PrismaService);
  });

  describe("findByUser", () => {
    it("returns disbursements ordered by createdAt desc", async () => {
      (prisma.disbursement.findMany as jest.Mock).mockResolvedValue([
        mockDisbursement,
      ]);

      const result = await service.findByUser("user-1");

      expect(prisma.disbursement.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: expect.objectContaining({
          id: true,
          vaultId: true,
          dripNumber: true,
        }),
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("dsb_abc123");
    });

    it("returns empty array when user has no disbursements", async () => {
      (prisma.disbursement.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.findByUser("user-no-disburse");
      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("returns the disbursement when found and owned by user", async () => {
      (prisma.disbursement.findFirst as jest.Mock).mockResolvedValue(
        mockDisbursement,
      );

      const result = await service.findById("dsb_abc123", "user-1");

      expect(prisma.disbursement.findFirst).toHaveBeenCalledWith({
        where: { id: "dsb_abc123", userId: "user-1" },
        select: expect.objectContaining({ id: true }),
      });
      expect(result.id).toBe("dsb_abc123");
      expect(result.amountKobo).toBe(BigInt(50000));
    });

    it("throws NotFoundException when disbursement not found", async () => {
      (prisma.disbursement.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findById("dsb_notexist", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when disbursement belongs to another user", async () => {
      (prisma.disbursement.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.findById("dsb_abc123", "user-other"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findDueVaults", () => {
    it("returns only vaults whose next drip time has passed", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");

      (prisma.vaultStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 1,
      });
      (prisma.vault.findMany as jest.Mock).mockResolvedValue([
        {
          id: "vlt_due",
          tranchesSent: 0,
          totalTranches: 4,
          startsAt,
          frequency: { name: "DAILY" },
        },
        {
          id: "vlt_not_due",
          tranchesSent: 0,
          totalTranches: 4,
          startsAt: new Date("2099-01-01T00:00:00Z"),
          frequency: { name: "DAILY" },
        },
      ]);

      const result = await service.findDueVaults();
      expect(result.map((v) => v.id)).toEqual(["vlt_due"]);
    });

    it("excludes vaults where all tranches have been sent", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");

      (prisma.vaultStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 1,
      });
      (prisma.vault.findMany as jest.Mock).mockResolvedValue([
        {
          id: "vlt_done",
          tranchesSent: 4,
          totalTranches: 4,
          startsAt,
          frequency: { name: "DAILY" },
        },
      ]);

      const result = await service.findDueVaults();
      expect(result).toHaveLength(0);
    });
  });
});
