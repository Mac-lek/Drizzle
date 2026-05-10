import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WalletService } from "./service.wallet";
import { PrismaService } from "@prisma-client/prisma.service";
import { LedgerService } from "@ledger/service.ledger";

const mockPrisma = {
  wallet: { findUnique: jest.fn() },
};

const mockLedger = {
  getBalance: jest.fn(),
  record: jest.fn(),
};

const WALLET = { id: "wlt_1", userId: "usr_1", paystackCustomerCode: null };

describe("WalletService", () => {
  let service: WalletService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedger },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  describe("findByUserId", () => {
    it("returns wallet when found", async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(WALLET);
      const result = await service.findByUserId("usr_1");
      expect(result).toEqual(WALLET);
    });

    it("throws NotFoundException when wallet does not exist", async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.findByUserId("usr_x")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getBalance", () => {
    it("delegates to ledger with USER_WALLET account type", async () => {
      mockLedger.getBalance.mockResolvedValue(BigInt(15000));
      const result = await service.getBalance("wlt_1");
      expect(mockLedger.getBalance).toHaveBeenCalledWith(
        "wlt_1",
        "USER_WALLET",
      );
      expect(result).toBe(BigInt(15000));
    });
  });

  describe("credit", () => {
    it("calls ledger.record with CREDIT direction", async () => {
      mockLedger.record.mockResolvedValue(undefined);
      await service.credit("wlt_1", BigInt(5000), "txn_1", "Funding");
      expect(mockLedger.record).toHaveBeenCalledWith("txn_1", [
        expect.objectContaining({
          accountId: "wlt_1",
          direction: "CREDIT",
          amountKobo: BigInt(5000),
        }),
      ]);
    });
  });

  describe("debit", () => {
    it("calls ledger.record with DEBIT direction", async () => {
      mockLedger.record.mockResolvedValue(undefined);
      await service.debit("wlt_1", BigInt(2000), "txn_2", "Vault lock");
      expect(mockLedger.record).toHaveBeenCalledWith("txn_2", [
        expect.objectContaining({
          accountId: "wlt_1",
          direction: "DEBIT",
          amountKobo: BigInt(2000),
        }),
      ]);
    });
  });
});
