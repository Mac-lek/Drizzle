import { Test, TestingModule } from "@nestjs/testing";
import { LedgerService } from "./service.ledger";
import { PrismaService } from "@prisma-client/prisma.service";

const mockPrisma = {
  accountType: { findUniqueOrThrow: jest.fn() },
  entryDirection: { findUniqueOrThrow: jest.fn() },
  ledgerEntry: { createMany: jest.fn(), aggregate: jest.fn() },
};

describe("LedgerService", () => {
  let service: LedgerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.accountType.findUniqueOrThrow.mockImplementation(({ where }) =>
      Promise.resolve({ id: where.name === "USER_WALLET" ? 1 : 2 }),
    );
    mockPrisma.entryDirection.findUniqueOrThrow.mockImplementation(
      ({ where }) => Promise.resolve({ id: where.name === "CREDIT" ? 10 : 20 }),
    );
    mockPrisma.ledgerEntry.createMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  describe("record", () => {
    it("creates ledger entries for all inputs", async () => {
      await service.record("txn_1", [
        {
          accountId: "wlt_1",
          accountType: "USER_WALLET",
          direction: "CREDIT",
          amountKobo: BigInt(10000),
          description: "test",
        },
      ]);

      expect(mockPrisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              transactionId: "txn_1",
              accountId: "wlt_1",
              amountKobo: BigInt(10000),
              directionId: 10,
              accountTypeId: 1,
            }),
          ]),
        }),
      );
    });

    it("caches account type and direction ids on second call", async () => {
      await service.record("txn_1", [
        {
          accountId: "wlt_1",
          accountType: "USER_WALLET",
          direction: "CREDIT",
          amountKobo: BigInt(1000),
          description: "a",
        },
      ]);
      await service.record("txn_2", [
        {
          accountId: "wlt_1",
          accountType: "USER_WALLET",
          direction: "CREDIT",
          amountKobo: BigInt(2000),
          description: "b",
        },
      ]);

      // Should only call DB once per unique type/direction due to cache
      expect(mockPrisma.accountType.findUniqueOrThrow).toHaveBeenCalledTimes(1);
      expect(mockPrisma.entryDirection.findUniqueOrThrow).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe("getBalance", () => {
    it("returns credit minus debit", async () => {
      mockPrisma.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amountKobo: BigInt(50000) } }) // credits
        .mockResolvedValueOnce({ _sum: { amountKobo: BigInt(20000) } }); // debits

      const balance = await service.getBalance("wlt_1", "USER_WALLET");

      expect(balance).toBe(BigInt(30000));
    });

    it("handles null aggregate sums (empty ledger)", async () => {
      mockPrisma.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amountKobo: null } })
        .mockResolvedValueOnce({ _sum: { amountKobo: null } });

      const balance = await service.getBalance("wlt_1", "USER_WALLET");

      expect(balance).toBe(BigInt(0));
    });
  });
});
