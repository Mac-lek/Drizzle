import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./service.payments";
import { PrismaService } from "@prisma-client/prisma.service";
import { UsersService } from "@users/service.users";
import { WalletService } from "@wallet/service.wallet";
import { PaystackProvider } from "./providers/paystack.provider";

const mockPrisma = {
  webhookEvent: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  wallet: { update: jest.fn() },
};

const mockUsers = { findById: jest.fn() };
const mockWallets = { findByUserId: jest.fn(), credit: jest.fn() };
const mockPaystack = {
  initializeTransaction: jest.fn(),
  createCustomer: jest.fn(),
  createDedicatedVirtualAccount: jest.fn(),
  verifySignature: jest.fn(),
};
const mockConfig = { get: jest.fn().mockReturnValue("wema-bank") };

const USER = {
  id: "usr_1",
  email: "user@test.com",
  firstName: "Test",
  lastName: "User",
  phoneNumber: "+2348000000000",
};
const WALLET = { id: "wlt_1", userId: "usr_1", paystackCustomerCode: null };

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsers },
        { provide: WalletService, useValue: mockWallets },
        { provide: PaystackProvider, useValue: mockPaystack },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe("initializeFunding", () => {
    it("throws BadRequestException when user has no email", async () => {
      mockUsers.findById.mockResolvedValue({ ...USER, email: null });
      await expect(
        service.initializeFunding("usr_1", { amountKobo: 10000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns authorization URL and reference on success", async () => {
      mockUsers.findById.mockResolvedValue(USER);
      mockWallets.findByUserId.mockResolvedValue(WALLET);
      mockPaystack.initializeTransaction.mockResolvedValue({
        authorization_url: "https://paystack.com/pay/xxx",
      });

      const result = await service.initializeFunding("usr_1", {
        amountKobo: 50000,
      });

      expect(result).toHaveProperty(
        "authorizationUrl",
        "https://paystack.com/pay/xxx",
      );
      expect(result).toHaveProperty("reference");
    });
  });

  describe("setupWalletCustomer", () => {
    it("throws BadRequestException when user has no email", async () => {
      mockUsers.findById.mockResolvedValue({ ...USER, email: null });
      await expect(service.setupWalletCustomer("usr_1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("is idempotent — skips if customer already set up", async () => {
      mockUsers.findById.mockResolvedValue(USER);
      mockWallets.findByUserId.mockResolvedValue({
        ...WALLET,
        paystackCustomerCode: "CUS_existing",
      });

      await service.setupWalletCustomer("usr_1");

      expect(mockPaystack.createCustomer).not.toHaveBeenCalled();
    });

    it("creates customer and DVA when not set up", async () => {
      mockUsers.findById.mockResolvedValue(USER);
      mockWallets.findByUserId.mockResolvedValue(WALLET);
      mockPaystack.createCustomer.mockResolvedValue({
        customer_code: "CUS_new",
      });
      mockPaystack.createDedicatedVirtualAccount.mockResolvedValue({
        account_number: "0123456789",
        bank: { name: "Wema Bank" },
      });
      mockPrisma.wallet.update.mockResolvedValue({});

      await service.setupWalletCustomer("usr_1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paystackCustomerCode: "CUS_new" }),
        }),
      );
    });
  });

  describe("handleWebhook", () => {
    it("throws UnauthorizedException on invalid signature", async () => {
      mockPaystack.verifySignature.mockReturnValue(false);
      await expect(
        service.handleWebhook(Buffer.from("{}"), "bad-sig"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("skips already-processed events", async () => {
      mockPaystack.verifySignature.mockReturnValue(true);
      const body = Buffer.from(
        JSON.stringify({
          event: "charge.success",
          data: { reference: "ref1", status: "success", amount: 5000 },
        }),
      );
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: "ref1",
        processed: true,
      });

      await service.handleWebhook(body, "sig");

      expect(mockWallets.credit).not.toHaveBeenCalled();
    });

    it("credits wallet on charge.success with valid metadata", async () => {
      mockPaystack.verifySignature.mockReturnValue(true);
      const payload = {
        event: "charge.success",
        data: {
          reference: "ref2",
          status: "success",
          amount: 10000,
          channel: "card",
          metadata: { userId: "usr_1", walletId: "wlt_1" },
        },
      };
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.upsert.mockResolvedValue({});
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockWallets.credit.mockResolvedValue(undefined);

      await service.handleWebhook(Buffer.from(JSON.stringify(payload)), "sig");

      expect(mockWallets.credit).toHaveBeenCalledWith(
        "wlt_1",
        BigInt(10000),
        "ref2",
        "Wallet funding via Paystack",
        expect.any(Object),
      );
    });
  });
});
