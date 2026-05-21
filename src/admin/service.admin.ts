import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "@prisma-client/prisma.service";
import { NotificationsService } from "@notifications/service.notifications";
import { generateId } from "@common/lib/utils/util.id";
import { AdminActivityType } from "./lib/enums/lib.enum.admin-activity";
import { InviteAdminDto } from "./lib/dto/dto.admin.invite";
import { UpdateAdminPermissionsDto } from "./lib/dto/dto.admin.update-permissions";
import { UpdateAdminStatusDto } from "./lib/dto/dto.admin.update-status";
import { ok } from "@common/lib/utils/util.response";

const INVITE_TTL_HOURS = 48;
const PROTECTED_ROLE = "SADM";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async invite(
    inviterId: string,
    dto: InviteAdminDto,
  ): Promise<{ message: string }> {
    if (dto.roleCode === PROTECTED_ROLE) {
      throw new ForbiddenException("Cannot invite another Super Admin");
    }

    const role = await this.prisma.adminRole.findUnique({
      where: { code: dto.roleCode },
    });
    if (!role) throw new BadRequestException(`Unknown role: ${dto.roleCode}`);

    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new ConflictException("An admin with this email already exists");

    const pendingStatus = await this.prisma.adminStatus.findUniqueOrThrow({
      where: { name: "PENDING" },
    });

    const admin = await this.prisma.admin.create({
      data: {
        id: generateId("adm"),
        email: dto.email,
        roleCode: dto.roleCode,
        statusId: pendingStatus.id,
        invitedById: inviterId,
      },
    });

    const rawToken = generateId("inv");
    const tokenHash = await argon2.hash(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.adminToken.create({
      data: {
        id: generateId("atok"),
        adminId: admin.id,
        type: "INVITE",
        token: tokenHash,
        expiresAt,
      },
    });

    this.notifications.sendAdminInvite(dto.email, role.name, rawToken, `${INVITE_TTL_HOURS} hours`);

    await this.log(
      inviterId,
      AdminActivityType.INVITE_ADMIN,
      `Invited ${dto.email} as ${dto.roleCode}`,
    );

    return ok(`Invite sent to ${dto.email}`);
  }

  async list() {
    return this.prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleCode: true,
        isProfileComplete: true,
        status: { select: { name: true } },
        invitedBy: { select: { id: true, email: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        roleCode: true,
        isProfileComplete: true,
        status: { select: { name: true } },
        role: { include: { permissions: { include: { resource: true } } } },
        userPermissions: { include: { resource: true } },
        invitedBy: { select: { id: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) throw new NotFoundException("Admin not found");
    return admin;
  }

  async updatePermissions(
    actorId: string,
    targetId: string,
    dto: UpdateAdminPermissionsDto,
  ): Promise<void> {
    const target = await this.prisma.admin.findUnique({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException("Admin not found");
    if (target.roleCode === PROTECTED_ROLE)
      throw new ForbiddenException("Cannot modify Super Admin permissions");

    await this.prisma.$transaction(
      dto.permissions.map((p) =>
        this.prisma.adminUserPermission.upsert({
          where: {
            adminId_resourceId: { adminId: targetId, resourceId: p.resourceId },
          },
          create: {
            adminId: targetId,
            resourceId: p.resourceId,
            permissions: p.permissions,
          },
          update: { permissions: p.permissions },
        }),
      ),
    );

    await this.log(
      actorId,
      AdminActivityType.UPDATE_PERMISSIONS,
      `Updated permissions for admin ${targetId}`,
    );
  }

  async updateStatus(
    actorId: string,
    targetId: string,
    dto: UpdateAdminStatusDto,
  ): Promise<void> {
    const target = await this.prisma.admin.findUnique({
      where: { id: targetId },
      include: { role: true },
    });

    if (!target) throw new NotFoundException("Admin not found");
    if (target.roleCode === PROTECTED_ROLE)
      throw new ForbiddenException("Cannot change Super Admin status");
    if (targetId === actorId)
      throw new ForbiddenException("Cannot change your own status");

    const newStatus = await this.prisma.adminStatus.findUnique({
      where: { name: dto.status },
    });
    if (!newStatus)
      throw new BadRequestException(`Unknown status: ${dto.status}`);

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { statusId: newStatus.id },
    });

    const activityType =
      {
        ACTIVE: AdminActivityType.ACTIVATE,
        SUSPENDED: AdminActivityType.SUSPEND,
        DEACTIVATED: AdminActivityType.DEACTIVATE,
      }[dto.status] ?? AdminActivityType.ACTIVATE;

    await this.log(
      actorId,
      activityType,
      `Set admin ${targetId} status to ${dto.status}`,
    );
  }

  async getActivityLogs(adminId: string) {
    return this.prisma.adminActivityLog.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  private async log(
    adminId: string,
    activityType: AdminActivityType,
    description: string,
  ) {
    await this.prisma.adminActivityLog
      .create({
        data: { id: generateId("aalg"), adminId, activityType, description },
      })
      .catch(() => {});
  }
}
