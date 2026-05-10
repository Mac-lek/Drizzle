import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { AdminService } from "./service.admin";
import { PrismaService } from "@prisma-client/prisma.service";
import { EmailProvider } from "@notifications/providers/nodemailer.provider";

const mockPrisma = {
  admin: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  adminRole: { findUnique: jest.fn() },
  adminStatus: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
  adminToken: { create: jest.fn() },
  adminUserPermission: { upsert: jest.fn() },
  adminActivityLog: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockEmail = { sendEmail: jest.fn().mockResolvedValue(undefined) };

const ACTIVE_STATUS = { id: 2, name: "ACTIVE" };
const PENDING_STATUS = { id: 1, name: "PENDING" };

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.adminActivityLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailProvider, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe("invite", () => {
    it("throws ForbiddenException when inviting SADM role", async () => {
      await expect(
        service.invite("adm_1", { email: "new@test.com", roleCode: "SADM" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequestException for unknown role", async () => {
      mockPrisma.adminRole.findUnique.mockResolvedValue(null);
      await expect(
        service.invite("adm_1", { email: "new@test.com", roleCode: "GHOST" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException when email already exists", async () => {
      mockPrisma.adminRole.findUnique.mockResolvedValue({
        code: "SUPPORT",
        name: "Customer Support",
      });
      mockPrisma.admin.findUnique.mockResolvedValue({ id: "adm_existing" });
      await expect(
        service.invite("adm_1", {
          email: "existing@test.com",
          roleCode: "SUPPORT",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("creates admin, token, and sends email on valid invite", async () => {
      mockPrisma.adminRole.findUnique.mockResolvedValue({
        code: "SUPPORT",
        name: "Customer Support",
      });
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      mockPrisma.adminStatus.findUniqueOrThrow.mockResolvedValue(
        PENDING_STATUS,
      );
      mockPrisma.admin.create.mockResolvedValue({ id: "adm_new" });
      mockPrisma.adminToken.create.mockResolvedValue({});

      const result = await service.invite("adm_1", {
        email: "new@test.com",
        roleCode: "SUPPORT",
      });

      expect(mockPrisma.admin.create).toHaveBeenCalled();
      expect(mockPrisma.adminToken.create).toHaveBeenCalled();
      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        "new@test.com",
        expect.stringContaining("invited"),
        expect.stringContaining("Customer Support"),
      );
      expect(result.message).toContain("Invite sent");
    });
  });

  describe("updatePermissions", () => {
    it("throws NotFoundException when target does not exist", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePermissions("adm_1", "adm_x", { permissions: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when target is SADM", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_sadm",
        roleCode: "SADM",
      });
      await expect(
        service.updatePermissions("adm_1", "adm_sadm", { permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("upserts permissions in transaction", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_2",
        roleCode: "SUPPORT",
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updatePermissions("adm_1", "adm_2", {
        permissions: [{ resourceId: 1, permissions: "read" }],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("throws NotFoundException when target does not exist", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus("adm_1", "adm_x", { status: "ACTIVE" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when target is SADM", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_sadm",
        roleCode: "SADM",
        role: {},
      });
      await expect(
        service.updateStatus("adm_1", "adm_sadm", { status: "SUSPENDED" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when changing own status", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_1",
        roleCode: "SUPPORT",
        role: {},
      });
      await expect(
        service.updateStatus("adm_1", "adm_1", { status: "SUSPENDED" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequestException for unknown status", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_2",
        roleCode: "SUPPORT",
        role: {},
      });
      mockPrisma.adminStatus.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus("adm_1", "adm_2", { status: "GHOST" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates status successfully", async () => {
      mockPrisma.admin.findUnique.mockResolvedValue({
        id: "adm_2",
        roleCode: "SUPPORT",
        role: {},
      });
      mockPrisma.adminStatus.findUnique.mockResolvedValue(ACTIVE_STATUS);
      mockPrisma.admin.update.mockResolvedValue({});

      await service.updateStatus("adm_1", "adm_2", { status: "ACTIVE" });

      expect(mockPrisma.admin.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { statusId: ACTIVE_STATUS.id } }),
      );
    });
  });

  describe("getActivityLogs", () => {
    it("returns last 100 logs for an admin", async () => {
      const logs = [{ id: "aalg_1", activityType: "LOGIN_SUCCESS" }];
      mockPrisma.adminActivityLog.findMany.mockResolvedValue(logs);

      const result = await service.getActivityLogs("adm_1");

      expect(mockPrisma.adminActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adminId: "adm_1" }, take: 100 }),
      );
      expect(result).toEqual(logs);
    });
  });
});
