import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KycService } from "./service.kyc";
import { DojahProvider } from "./providers/provider.dojah";
import { SmileProvider } from "./providers/provider.smile";
import { PrismaService } from "@prisma-client/prisma.service";
import { encryptBvn, decryptBvn } from "./lib/util.bvn-encrypt";

const TEST_KEY = "a".repeat(64);

const mockUser = (kycStatusName: string, extras: object = {}) => ({
  firstName: "John",
  lastName: "Doe",
  bvnVerified: false,
  kycStatus: { name: kycStatusName },
  ...extras,
});

describe("KycService", () => {
  let service: KycService;
  let prisma: jest.Mocked<PrismaService>;
  let dojah: jest.Mocked<DojahProvider>;
  let smile: jest.Mocked<SmileProvider>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
            kycStatus: { findUniqueOrThrow: jest.fn() },
            webhookEvent: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        { provide: DojahProvider, useValue: { verifyBvn: jest.fn() } },
        {
          provide: SmileProvider,
          useValue: {
            createVerificationLink: jest.fn(),
            verifyWebhookSignature: jest.fn(),
          },
        },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
      ],
    }).compile();

    service = module.get(KycService);
    prisma = module.get(PrismaService);
    dojah = module.get(DojahProvider);
    smile = module.get(SmileProvider);
    config = module.get(ConfigService);
  });

  describe("getStatus", () => {
    it("returns kycStatus and bvnVerified", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: true,
        kycStatus: { name: "TIER_1_VERIFIED" },
      });
      expect(await service.getStatus("usr_1")).toEqual({
        kycStatus: "TIER_1_VERIFIED",
        bvnVerified: true,
      });
    });
  });

  describe("submitTier1", () => {
    it("verifies BVN, encrypts it, and sets TIER_1_VERIFIED", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE"),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: "JOHN",
        lastName: "DOE",
        dateOfBirth: "",
        phoneNumber: "",
      });
      (config.getOrThrow as jest.Mock).mockReturnValue(TEST_KEY);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.submitTier1("usr_1", { bvn: "12345678901" });

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.bvnVerified).toBe(true);
      expect(updateCall.data.kycStatusId).toBe(3);
    });

    it("throws ConflictException if already TIER_1_VERIFIED", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("TIER_1_VERIFIED"),
      );
      await expect(
        service.submitTier1("usr_1", { bvn: "12345678901" }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws BadRequestException if profile incomplete", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE", { firstName: null, lastName: null }),
      );
      await expect(
        service.submitTier1("usr_1", { bvn: "12345678901" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("sets FAILED and re-throws when Dojah fails", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE"),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockRejectedValue(new Error("Dojah down"));
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.submitTier1("usr_1", { bvn: "12345678901" }),
      ).rejects.toThrow("Dojah down");
      expect(
        (prisma.user.update as jest.Mock).mock.calls[0][0].data.kycStatusId,
      ).toBe(6);
    });

    it("allows retry when previous attempt FAILED", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("FAILED"),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: "JOHN",
        lastName: "DOE",
        dateOfBirth: "",
        phoneNumber: "",
      });
      (config.getOrThrow as jest.Mock).mockReturnValue(TEST_KEY);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.submitTier1("usr_1", { bvn: "12345678901" }),
      ).resolves.not.toThrow();
    });
  });

  describe("initiateTier2", () => {
    it("creates a Smile link and sets TIER_2_PENDING", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("TIER_1_VERIFIED"),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 4,
      });
      (smile.createVerificationLink as jest.Mock).mockResolvedValue(
        "https://links.usesmileid.com/abc",
      );
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.initiateTier2("usr_1");

      expect(result.url).toBe("https://links.usesmileid.com/abc");
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.kycStatusId).toBe(4);
    });

    it("throws ConflictException if Tier 1 not completed", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE"),
      );
      await expect(service.initiateTier2("usr_1")).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("handleSmileCallback", () => {
    const baseBody = {
      partner_id: "p1",
      timestamp: "2026-01-01T00:00:00.000Z",
      signature: "sig",
      ResultCode: "1012",
      ResultText: "Exact Match",
      PartnerParams: { user_id: "usr_1", job_id: "kyc2_abc", job_type: 1 },
    };

    it("sets TIER_2_VERIFIED on ResultCode 1012", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockReturnValue(undefined);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.upsert as jest.Mock).mockResolvedValue({});
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 5,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.webhookEvent.update as jest.Mock).mockResolvedValue({});

      await service.handleSmileCallback(baseBody);

      expect(prisma.kycStatus.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { name: "TIER_2_VERIFIED" },
      });
    });

    it("sets FAILED on non-1012 ResultCode", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockReturnValue(undefined);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.upsert as jest.Mock).mockResolvedValue({});
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 6,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.webhookEvent.update as jest.Mock).mockResolvedValue({});

      await service.handleSmileCallback({ ...baseBody, ResultCode: "1020" });

      expect(prisma.kycStatus.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { name: "FAILED" },
      });
    });

    it("skips processing if event already processed", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockReturnValue(undefined);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue({
        processed: true,
      });

      await service.handleSmileCallback(baseBody);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedException on bad signature", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedException("Invalid Smile webhook signature");
      });

      await expect(service.handleSmileCallback(baseBody)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe("BVN encryption", () => {
  it("round-trips correctly", () => {
    const bvn = "12345678901";
    const encrypted = encryptBvn(bvn, TEST_KEY);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptBvn(encrypted, TEST_KEY)).toBe(bvn);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const bvn = "12345678901";
    expect(encryptBvn(bvn, TEST_KEY)).not.toBe(encryptBvn(bvn, TEST_KEY));
  });
});
