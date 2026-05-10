import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { AdminAuthService } from "./service.admin-auth";
import { PrismaService } from "@prisma-client/prisma.service";
import { EmailProvider } from "@notifications/providers/nodemailer.provider";

const mockPrisma = {
  admin: { findUnique: jest.fn(), update: jest.fn() },
  adminToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  adminStatus: { findUniqueOrThrow: jest.fn() },
  adminActivityLog: { create: jest.fn() },
};

const mockJwt = { sign: jest.fn().mockReturnValue("access-token") };
const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue("secret"),
  get: jest.fn().mockReturnValue("15m"),
};
const mockEmail = { sendEmail: jest.fn().mockResolvedValue(undefined) };

const ACTIVE_ADMIN = {
  id: "adm_123",
  email: "admin@drizzle.app",
  passwordHash: null as string | null,
  roleCode: "SUPPORT",
  invalidOtpCount: 0,
  status: { name: "ACTIVE" },
};

describe("AdminAuthService", () => {
  let service: AdminAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.adminActivityLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailProvider, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  describe("login", () => {
    it("throws generic error when admin not found", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: "x@x.com", password: "pass" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws generic error when password is null (pending invite)", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        ...ACTIVE_ADMIN,
        passwordHash: null,
      });
      await expect(
        service.login({ email: ACTIVE_ADMIN.email, password: "pass" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws generic error when admin is not ACTIVE", async () => {
      const hash = await argon2.hash("correct");
      mockPrisma.admin.findUnique.mockResolvedValue({
        ...ACTIVE_ADMIN,
        passwordHash: hash,
        status: { name: "SUSPENDED" },
      });
      await expect(
        service.login({ email: ACTIVE_ADMIN.email, password: "correct" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws on wrong password and logs LOGIN_FAILED", async () => {
      const hash = await argon2.hash("correct");
      mockPrisma.admin.findUnique.mockResolvedValue({
        ...ACTIVE_ADMIN,
        passwordHash: hash,
      });
      await expect(
        service.login({ email: ACTIVE_ADMIN.email, password: "wrong" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("sends OTP email on valid credentials", async () => {
      const hash = await argon2.hash("correct");
      mockPrisma.admin.findUnique.mockResolvedValue({
        ...ACTIVE_ADMIN,
        passwordHash: hash,
      });
      mockPrisma.adminToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.adminToken.create.mockResolvedValue({});

      const result = await service.login({
        email: ACTIVE_ADMIN.email,
        password: "correct",
      });

      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        ACTIVE_ADMIN.email,
        expect.stringContaining("OTP"),
        expect.stringContaining("Your OTP is"),
      );
      expect(result).toEqual({ message: "OTP sent to your email" });
    });
  });

  describe("verifyOtp", () => {
    it("throws when admin not found", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyOtp({ email: "x@x.com", otp: "123456" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws when account locked (too many attempts)", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        ...ACTIVE_ADMIN,
        invalidOtpCount: 5,
      });
      await expect(
        service.verifyOtp({ email: ACTIVE_ADMIN.email, otp: "123456" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws and increments count on invalid OTP", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({ ...ACTIVE_ADMIN });
      const hash = await argon2.hash("111111");
      mockPrisma.adminToken.findFirst.mockResolvedValue({
        id: "tok1",
        token: hash,
      });
      mockPrisma.admin.update.mockResolvedValue({});

      await expect(
        service.verifyOtp({ email: ACTIVE_ADMIN.email, otp: "999999" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { invalidOtpCount: { increment: 1 } },
        }),
      );
    });

    it("returns tokens on valid OTP", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({ ...ACTIVE_ADMIN });
      const hash = await argon2.hash("123456");
      mockPrisma.adminToken.findFirst.mockResolvedValue({
        id: "tok1",
        token: hash,
      });
      mockPrisma.adminToken.update.mockResolvedValue({});
      mockPrisma.admin.update.mockResolvedValue({});
      mockPrisma.adminToken.create.mockResolvedValue({});

      const result = await service.verifyOtp({
        email: ACTIVE_ADMIN.email,
        otp: "123456",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });
  });

  describe("acceptInvite", () => {
    it("throws on invalid token", async () => {
      mockPrisma.adminToken.findFirst.mockResolvedValue(null);
      await expect(
        service.acceptInvite({ token: "bad", password: "pass123" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws if admin is not PENDING", async () => {
      const hash = await argon2.hash("goodtoken");
      mockPrisma.adminToken.findFirst.mockResolvedValue({
        id: "tok1",
        token: hash,
        admin: { id: "adm_1", status: { name: "ACTIVE" } },
      });
      await expect(
        service.acceptInvite({ token: "goodtoken", password: "pass123" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("activates account on valid invite", async () => {
      const hash = await argon2.hash("goodtoken");
      mockPrisma.adminToken.findFirst.mockResolvedValue({
        id: "tok1",
        token: hash,
        admin: { id: "adm_1", status: { name: "PENDING" } },
      });
      mockPrisma.adminStatus.findUniqueOrThrow.mockResolvedValue({ id: 2 });
      mockPrisma.admin.update.mockResolvedValue({});
      mockPrisma.adminToken.update.mockResolvedValue({});

      const result = await service.acceptInvite({
        token: "goodtoken",
        password: "NewPass123!",
      });

      expect(mockPrisma.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statusId: 2 }),
        }),
      );
      expect(result.message).toContain("activated");
    });
  });
});
