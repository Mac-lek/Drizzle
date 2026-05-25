import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "./service.users";
import { PrismaService } from "@prisma-client/prisma.service";
import { DojahProvider } from "../kyc/providers/provider.dojah";
import { WalletService } from "../wallet/service.wallet";

const TEST_KEY = "a".repeat(64);

const mockKycStatus = { id: 1, name: "NONE", label: "None" };
const mockUserStatus = { id: 1, name: "ACTIVE", label: "Active" };

const mockUser = {
  id: "user-1",
  phoneNumber: "+2348012345678",
  email: null,
  pinHash: null,
  statusId: 1,
  kycStatusId: 1,
  firstName: null,
  lastName: null,
  bvnEncrypted: null,
  bvnVerified: false,
  fcmToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UsersService", () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;
  let dojah: jest.Mocked<DojahProvider>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            kycStatus: {
              findUniqueOrThrow: jest.fn().mockResolvedValue(mockKycStatus),
            },
            userStatus: {
              findUniqueOrThrow: jest.fn().mockResolvedValue(mockUserStatus),
            },
          },
        },
        { provide: DojahProvider, useValue: { verifyBvn: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue(TEST_KEY) } },
        { provide: WalletService, useValue: { getBalance: jest.fn().mockResolvedValue(BigInt(0)) } },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
    dojah = module.get(DojahProvider);
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await service.findById("user-1");
      expect(result).toEqual(mockUser);
    });

    it("returns null when not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.findById("unknown");
      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("looks up by email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await service.findByEmail("user@example.com");
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user@example.com" },
      });
    });
  });

  describe("findOrCreate", () => {
    it("returns existing user without creating a new one", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const { created } = await service.findOrCreate("08012345678");

      expect(created).toBe(false);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("normalizes the phone number to E.164", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.findOrCreate("08012345678");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phoneNumber: "+2348012345678" },
      });
    });

    it("creates a new user with wallet when phone is not registered", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const { created } = await service.findOrCreate("08012345678");

      expect(created).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: "+2348012345678",
            wallet: { create: expect.objectContaining({}) },
          }),
        }),
      );
    });

    it("includes email when provided", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: "u@example.com",
      });

      await service.findOrCreate("08012345678", "u@example.com");

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "u@example.com" }),
        }),
      );
    });
  });

  describe("setPassword", () => {
    it("updates the user passwordHash", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.setPassword("user-1", "hashed-password");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { passwordHash: "hashed-password" },
      });
    });
  });

  describe("getProfile", () => {
    const mockUserWithRelations = {
      ...mockUser,
      kycStatus: { name: "NONE" },
      status: { name: "ACTIVE" },
      wallet: { id: "wlt-1" },
    };

    it("returns profileComplete false when any required field is missing", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserWithRelations,
      );

      const result = await service.getProfile("user-1");

      expect(result.profileComplete).toBe(false);
      expect(result.kycStatus).toBe("NONE");
      expect(result.status).toBe("ACTIVE");
    });

    it("returns profileComplete true when all required fields including bvnVerified are set", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUserWithRelations,
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
        phoneNumber: "+2348012345678",
        bvnVerified: true,
        dateOfBirth: new Date("1995-04-12"),
        gender: "FEMALE",
      });

      const result = await service.getProfile("user-1");

      expect(result.profileComplete).toBe(true);
    });

    it("returns profileComplete false when bvnVerified is false even if other fields are set", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUserWithRelations,
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
        phoneNumber: "+2348012345678",
        bvnVerified: false,
      });

      const result = await service.getProfile("user-1");

      expect(result.profileComplete).toBe(false);
    });

    it("returns profileComplete false when phone is missing (email-only signup)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUserWithRelations,
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
        phoneNumber: null,
        bvnVerified: true,
      });

      const result = await service.getProfile("user-1");

      expect(result.profileComplete).toBe(false);
    });

    it("throws NotFoundException when user does not exist", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile("unknown")).rejects.toThrow(
        "User not found",
      );
    });
  });

  describe("updateProfile", () => {
    it("updates only provided fields", async () => {
      const updated = { ...mockUser, firstName: "Ada" };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile("user-1", {
        firstName: "Ada",
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: "Ada" },
        }),
      );
      expect(result.firstName).toBe("Ada");
    });

    it("does not include undefined fields in the update payload", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.updateProfile("user-1", { firstName: "Ada" });

      const call = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
      expect(call?.data).not.toHaveProperty("email");
      expect(call?.data).not.toHaveProperty("lastName");
    });

    it("normalizes phone to E.164 when provided", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.updateProfile("user-1", { phone: "08012345678" });

      const call = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
      expect(call?.data.phoneNumber).toBe("+2348012345678");
    });
  });

  describe("submitBvn", () => {
    it("verifies BVN, encrypts it, and sets bvnVerified", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: false,
        firstName: "Ada",
        lastName: "Obi",
      });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: "ADA",
        lastName: "OBI",
        dateOfBirth: "",
        phoneNumber: "",
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.submitBvn("user-1", { bvn: "12345678901" });

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.bvnVerified).toBe(true);
      expect(updateCall.data.bvnEncrypted).toBeDefined();
    });

    it("throws ConflictException if BVN already verified", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: true,
        firstName: "Ada",
        lastName: "Obi",
      });

      await expect(
        service.submitBvn("user-1", { bvn: "12345678901" }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws BadRequestException if profile incomplete", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: false,
        firstName: null,
        lastName: null,
      });

      await expect(
        service.submitBvn("user-1", { bvn: "12345678901" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if name does not match BVN record", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: false,
        firstName: "Ada",
        lastName: "Obi",
      });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: "JOHN",
        lastName: "DOE",
        dateOfBirth: "",
        phoneNumber: "",
      });

      await expect(
        service.submitBvn("user-1", { bvn: "12345678901" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("accepts when profile name is one word within a compound Dojah name", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: false,
        firstName: "Ada",
        lastName: "Obi",
      });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: "ADA CHIOMA",
        lastName: "OBI",
        dateOfBirth: "",
        phoneNumber: "",
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.submitBvn("user-1", { bvn: "12345678901" }),
      ).resolves.not.toThrow();
    });

    it("re-throws when Dojah fails", async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: false,
        firstName: "Ada",
        lastName: "Obi",
      });
      (dojah.verifyBvn as jest.Mock).mockRejectedValue(new Error("Dojah down"));

      await expect(
        service.submitBvn("user-1", { bvn: "12345678901" }),
      ).rejects.toThrow("Dojah down");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
