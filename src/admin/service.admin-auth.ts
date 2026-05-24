import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { PrismaService } from "@prisma-client/prisma.service";
import { NotificationsService } from "@notifications/service.notifications";
import { generateId } from "@common/lib/utils/util.id";
import { AdminActivityType } from "./lib/enums/lib.enum.admin-activity";
import { AdminLoginDto } from "./lib/dto/dto.admin-auth.login";
import { AdminVerifyOtpDto } from "./lib/dto/dto.admin-auth.verify-otp";
import { AcceptInviteDto } from "./lib/dto/dto.admin-auth.accept-invite";
import { AdminRefreshDto } from "./lib/dto/dto.admin-auth.refresh";
import { ok } from "@common/lib/utils/util.response";
import { TOKEN_REFRESHED } from "@common/lib/enums/lib.enum.messages";

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: AdminLoginDto, ip?: string): Promise<{ message: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
      include: { status: { select: { name: true } } },
    });

    await this.log(
      admin?.id,
      AdminActivityType.LOGIN_REQUEST,
      `Login attempt for ${dto.email}`,
      ip,
    );

    // Generic error — never reveal whether email exists
    const invalid = () => new UnauthorizedException("Invalid credentials");

    if (!admin || !admin.passwordHash) {
      this.logger.warn(`login: admin not found or no password email=${dto.email}`);
      throw invalid();
    }
    if (!["ACTIVE"].includes(admin.status.name)) {
      this.logger.warn(`login: admin not active id=${admin.id} status=${admin.status.name}`);
      throw invalid();
    }

    const passwordValid = await argon2.verify(admin.passwordHash, dto.password);
    if (!passwordValid) {
      this.logger.warn(`login: wrong password id=${admin.id}`);
      await this.log(admin.id, AdminActivityType.LOGIN_FAILED, "Wrong password", ip);
      throw invalid();
    }

    // Invalidate old OTPs, issue new one
    await this.prisma.adminToken.updateMany({
      where: { adminId: admin.id, type: "OTP", used: false },
      data: { used: true },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.adminToken.create({
      data: {
        id: generateId("atok"),
        adminId: admin.id,
        type: "OTP",
        token: otpHash,
        expiresAt,
      },
    });

    this.notifications.sendAdminOtp(admin.email, otp);
    this.logger.log(`login: OTP sent id=${admin.id}`);

    return ok("OTP sent to your email");
  }

  async verifyOtp(dto: AdminVerifyOtpDto, ip?: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
      include: { status: { select: { name: true } } },
    });

    if (!admin || admin.status.name !== "ACTIVE") {
      this.logger.warn(`verifyOtp: admin not found or not active email=${dto.email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    if (admin.invalidOtpCount >= MAX_OTP_ATTEMPTS) {
      this.logger.warn(`verifyOtp: account locked id=${admin.id} attempts=${admin.invalidOtpCount}`);
      throw new UnauthorizedException(
        "Account locked due to too many failed OTP attempts",
      );
    }

    const otpRecord = await this.prisma.adminToken.findFirst({
      where: {
        adminId: admin.id,
        type: "OTP",
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const valid = otpRecord && (await argon2.verify(otpRecord.token, dto.otp));

    if (!valid) {
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { invalidOtpCount: { increment: 1 } },
      });
      await this.log(admin.id, AdminActivityType.LOGIN_FAILED, "Invalid OTP", ip);
      this.logger.warn(`verifyOtp: invalid OTP id=${admin.id}`);
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await this.prisma.adminToken.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { invalidOtpCount: 0 },
    });

    const tokens = await this.issueTokens(admin.id, admin.email, admin.roleCode);
    await this.log(admin.id, AdminActivityType.LOGIN_SUCCESS, "Login successful", ip);
    this.logger.log(`verifyOtp: login success id=${admin.id}`);

    return ok("Login successful", tokens);
  }

  async refresh(dto: AdminRefreshDto) {
    const record = await this.prisma.adminToken.findFirst({
      where: { type: "REFRESH", used: false, expiresAt: { gt: new Date() } },
      include: { admin: { include: { status: { select: { name: true } } } } },
    });

    const valid =
      record && (await argon2.verify(record.token, dto.refreshToken));
    if (!valid || record.admin.status.name !== "ACTIVE") {
      this.logger.warn(`refresh: invalid or expired refresh token`);
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.adminToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    const tokens = await this.issueTokens(
      record.admin.id,
      record.admin.email,
      record.admin.roleCode,
    );
    this.logger.log(`refresh: token rotated id=${record.admin.id}`);
    return ok(TOKEN_REFRESHED, tokens);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ message: string }> {
    const record = await this.prisma.adminToken.findFirst({
      where: { type: "INVITE", used: false, expiresAt: { gt: new Date() } },
      include: { admin: { include: { status: { select: { name: true } } } } },
    });

    const valid = record && (await argon2.verify(record.token, dto.token));
    if (!valid) {
      this.logger.warn(`acceptInvite: invalid or expired token`);
      throw new BadRequestException("Invalid or expired invite token");
    }
    if (record.admin.status.name !== "PENDING") {
      this.logger.warn(`acceptInvite: already accepted id=${record.admin.id}`);
      throw new BadRequestException("Invite already accepted");
    }

    const activeStatus = await this.prisma.adminStatus.findUniqueOrThrow({
      where: { name: "ACTIVE" },
    });
    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.admin.update({
      where: { id: record.admin.id },
      data: { passwordHash, statusId: activeStatus.id },
    });

    await this.prisma.adminToken.update({
      where: { id: record.id },
      data: { used: true },
    });
    await this.log(
      record.admin.id,
      AdminActivityType.ACCEPT_INVITE,
      "Invite accepted, account activated",
    );
    this.logger.log(`acceptInvite: account activated id=${record.admin.id}`);

    return ok("Account activated. You can now log in.");
  }

  private async issueTokens(adminId: string, email: string, role: string) {
    const payload = { sub: adminId, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow("ADMIN_JWT_ACCESS_SECRET"),
      expiresIn: this.config.get("ADMIN_JWT_ACCESS_TTL", "15m"),
    });

    const rawRefresh = generateId("rfsh");
    const refreshHash = await argon2.hash(rawRefresh);
    const refreshTtlDays = 30;

    await this.prisma.adminToken.create({
      data: {
        id: generateId("atok"),
        adminId,
        type: "REFRESH",
        token: refreshHash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private async log(
    adminId: string | undefined,
    activityType: AdminActivityType,
    description: string,
    ipAddress?: string,
  ) {
    if (!adminId) return;
    await this.prisma.adminActivityLog
      .create({
        data: {
          id: generateId("aalg"),
          adminId,
          activityType,
          description,
          ipAddress,
        },
      })
      .catch(() => {
        /* never fail a request over logging */
      });
  }
}
