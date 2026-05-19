import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { KycService } from "./service.kyc";
import { SmileProvider } from "./providers/provider.smile";
import { PrismaService } from "@prisma-client/prisma.service";
import { encryptBvn, decryptBvn } from "./lib/util.bvn-encrypt";

const TEST_KEY = "a".repeat(64);

const mockUser = (kycStatusName: string, bvnVerified = false) => ({
  bvnVerified,
  kycStatus: { name: kycStatusName },
});

describe("KycService", () => {
  let service: KycService;
  let prisma: jest.Mocked<PrismaService>;
  let smile: jest.Mocked<SmileProvider>;

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
        {
          provide: SmileProvider,
          useValue: {
            createVerificationLink: jest.fn(),
            verifyWebhookSignature: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(KycService);
    prisma = module.get(PrismaService);
    smile = module.get(SmileProvider);
  });

  describe("getStatus", () => {
    it("returns kycStatus", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        kycStatus: { name: "NONE" },
      });
      expect(await service.getStatus("usr_1")).toEqual({ kycStatus: "NONE" });
    });
  });

  describe("initiate", () => {
    it("creates a Smile link and sets PENDING", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE", true),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
      });
      (smile.createVerificationLink as jest.Mock).mockResolvedValue(
        "https://links.usesmileid.com/abc",
      );
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.initiate("usr_1");

      expect(result.url).toBe("https://links.usesmileid.com/abc");
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.kycStatusId).toBe(2);
    });

    it("throws ConflictException if BVN not verified", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("NONE", false),
      );
      await expect(service.initiate("usr_1")).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException if already PENDING", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("PENDING", true),
      );
      await expect(service.initiate("usr_1")).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException if already VERIFIED", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("VERIFIED", true),
      );
      await expect(service.initiate("usr_1")).rejects.toThrow(ConflictException);
    });

    it("allows retry from FAILED state", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser("FAILED", true),
      );
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
      });
      (smile.createVerificationLink as jest.Mock).mockResolvedValue(
        "https://links.usesmileid.com/abc",
      );
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(service.initiate("usr_1")).resolves.not.toThrow();
    });
  });

  describe("handleSmileCallback", () => {
    const baseBody = {
      partner_id: "p1",
      timestamp: "2026-01-01T00:00:00.000Z",
      signature: "sig",
      ResultCode: "1012",
      ResultText: "Exact Match",
      PartnerParams: { user_id: "usr_1", job_id: "kyc_abc", job_type: 1 },
    };

    it("sets VERIFIED on ResultCode 1012", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockReturnValue(undefined);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.upsert as jest.Mock).mockResolvedValue({});
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 3,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.webhookEvent.update as jest.Mock).mockResolvedValue({});

      await service.handleSmileCallback(baseBody);

      expect(prisma.kycStatus.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { name: "VERIFIED" },
      });
    });

    it("sets FAILED on non-1012 ResultCode", async () => {
      (smile.verifyWebhookSignature as jest.Mock).mockReturnValue(undefined);
      (prisma.webhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.webhookEvent.upsert as jest.Mock).mockResolvedValue({});
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 4,
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
