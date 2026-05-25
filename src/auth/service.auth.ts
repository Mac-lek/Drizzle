import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "@prisma-client/prisma.service";
import { UsersService } from "@users/service.users";
import { NotificationsService } from "@notifications/service.notifications";
import { normalizeNigerianPhone, isEmail } from "@common/lib/utils/util.phone";
import { generateId } from "@common/lib/utils/util.id";
import {
  VERIFICATION_OTP_SENT,
  VERIFICATION_OTP_RESENT,
  INVALID_OTP,
  INVALID_PASSWORD,
  SET_PASSWORD,
  SET_TRANSACTION_PIN,
  DEVICE_VERIFIED,
  USER_LOGIN_SUCCESSFULLY,
  ACCOUNT_DEACTIVATED,
  TOKEN_REFRESHED,
  NEW_DEVICE_DETECTED,
  PASSWORD_RESET_OTP_SENT,
  PASSWORD_RESET,
  CHANGE_PASSWORD,
} from "@common/lib/enums/lib.enum.messages";
import { ok } from "@common/lib/utils/util.response";
import { SignupDto } from "./lib/dto/dto.auth.signup";
import { VerifyOtpDto } from "./lib/dto/dto.auth.verify-otp";
import { SetPasswordDto } from "./lib/dto/dto.auth.set-password";
import { SetTransactionPinDto } from "./lib/dto/dto.auth.set-transaction-pin";
import { VerifyDeviceDto } from "./lib/dto/dto.auth.verify-device";
import { LoginDto } from "./lib/dto/dto.auth.login";
import { RefreshDto } from "./lib/dto/dto.auth.refresh";
import { ForgotPasswordDto } from "./lib/dto/dto.auth.forgot-password";
import { ResetPasswordDto } from "./lib/dto/dto.auth.reset-password";
import { ChangePasswordDto } from "./lib/dto/dto.auth.change-password";
import { JwtPayload } from "./strategies/jwt.strategy";

const OTP_TTL_MINUTES = 10;
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto) {
    const phone = dto.phone ? normalizeNigerianPhone(dto.phone) : undefined;
    const { user, created } = await this.users.findOrCreate(phone, dto.email);
    this.logger.log(`signup: user=${user.id} created=${created}`);

    if (!user.passwordHash) {
      const otp = this.generateOtp();
      await this.storeToken(user.id, otp, "OTP");

      if (phone) {
        this.notifications.sendPhoneOtp(phone, otp);
        this.logger.log(`signup: OTP sent via SMS user=${user.id}`);
      } else {
        this.notifications.sendEmailOtp(dto.email!, otp);
        this.logger.log(`signup: OTP sent via email user=${user.id}`);
      }

      return ok(VERIFICATION_OTP_SENT, { otp });
    }

    this.logger.log(`signup: already registered, skipping OTP user=${user.id}`);
    return ok(VERIFICATION_OTP_SENT);
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.resolveByIdentifier(dto.identifier);

    const invalid = new UnauthorizedException(INVALID_OTP);
    if (!user) {
      this.logger.warn(`verifyOtp: user not found identifier=${dto.identifier}`);
      throw invalid;
    }

    const otpTypeId = await this.resolveTokenTypeId("OTP");
    const token = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        typeId: otpTypeId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token || token.token !== dto.otp) {
      this.logger.warn(`verifyOtp: invalid or expired OTP user=${user.id}`);
      throw invalid;
    }

    await this.prisma.token.update({
      where: { id: token.id },
      data: { used: true },
    });

    this.logger.log(`verifyOtp: success user=${user.id}`);
    const identifier = user.phoneNumber ?? user.email!;
    const accessToken = this.signAccess(user.id, identifier, "onboarding", "1h");
    return ok("OTP verified successfully", { accessToken });
  }

  // ─── Set Password ─────────────────────────────────────────────────────────

  async setPassword(userId: string, dto: SetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      this.logger.warn(`setPassword: passwords do not match user=${userId}`);
      throw new BadRequestException("Passwords do not match");
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.users.setPassword(userId, passwordHash);
    this.logger.log(`setPassword: password set user=${userId}`);

    const user = await this.users.findById(userId);
    const identifier = user!.phoneNumber ?? user!.email!;
    const { accessToken, refreshToken } = await this.issueTokenPair(user!.id, identifier);

    return ok(SET_PASSWORD, { accessToken, refreshToken });
  }

  // ─── Set Transaction PIN ──────────────────────────────────────────────────

  async setTransactionPin(userId: string, dto: SetTransactionPinDto) {
    const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
    await this.users.setTransactionPin(userId, pinHash);
    this.logger.log(`setTransactionPin: PIN set user=${userId}`);
    return ok(SET_TRANSACTION_PIN);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.resolveByIdentifier(dto.identifier);

    const invalid = new UnauthorizedException(INVALID_PASSWORD);
    if (!user || !user.passwordHash) {
      this.logger.warn(`login: user not found or no password identifier=${dto.identifier}`);
      throw invalid;
    }

    const statusName = await this.prisma.userStatus
      .findUnique({ where: { id: user.statusId } })
      .then((s) => s?.name);

    if (statusName !== "ACTIVE") {
      this.logger.warn(`login: account not active user=${user.id} status=${statusName}`);
      throw new ForbiddenException(ACCOUNT_DEACTIVATED);
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      this.logger.warn(`login: invalid password user=${user.id}`);
      throw invalid;
    }

    const identifier = user.phoneNumber ?? user.email!;

    if (dto.fcmToken) {
      const knownDevice = await this.prisma.userDevice.findFirst({
        where: { userId: user.id, fcmToken: dto.fcmToken, trusted: true },
      });

      if (!knownDevice) {
        this.logger.log(`login: new device detected, sending OTP user=${user.id}`);
        const otp = await this.sendDeviceVerifyOtp(user, dto.fcmToken);
        const isProduction = this.config.get<string>("NODE_ENV") === "production";
        return ok(NEW_DEVICE_DETECTED, { requiresDeviceVerification: true, ...(!isProduction && { otp }) });
      }

      await this.prisma.userDevice.update({
        where: { id: knownDevice.id },
        data: { trusted: true },
      });
      this.logger.log(`login: known device verified user=${user.id} device=${knownDevice.id}`);
    } else {
      this.logger.log(`login: no fcmToken provided, sending device OTP user=${user.id}`);
      const otp = await this.sendDeviceVerifyOtp(user, null);
      const isProduction = this.config.get<string>("NODE_ENV") === "production";
      return ok(NEW_DEVICE_DETECTED, { requiresDeviceVerification: true, ...(!isProduction && { otp }) });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, identifier);
    this.logger.log(`login: success user=${user.id}`);
    return ok(USER_LOGIN_SUCCESSFULLY, { accessToken, refreshToken });
  }

  // ─── Verify Device ────────────────────────────────────────────────────────

  async verifyDevice(dto: VerifyDeviceDto) {
    const user = await this.resolveByIdentifier(dto.identifier);

    const invalid = new UnauthorizedException(INVALID_OTP);
    if (!user) {
      this.logger.warn(`verifyDevice: user not found identifier=${dto.identifier}`);
      throw invalid;
    }

    const typeId = await this.resolveTokenTypeId("DEVICE_VERIFY");
    const token = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        typeId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token || token.token !== dto.otp) {
      this.logger.warn(`verifyDevice: invalid or expired OTP user=${user.id}`);
      throw invalid;
    }

    await this.prisma.token.update({ where: { id: token.id }, data: { used: true } });

    await this.prisma.userDevice.upsert({
      where: { userId_fcmToken: { userId: user.id, fcmToken: dto.fcmToken } },
      create: {
        id: generateId("dev"),
        userId: user.id,
        fcmToken: dto.fcmToken,
        trusted: true,
      },
      update: { trusted: true },
    });

    this.logger.log(`verifyDevice: device trusted user=${user.id}`);
    const identifier = user.phoneNumber ?? user.email!;
    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, identifier);
    return ok(DEVICE_VERIFIED, { accessToken, refreshToken });
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      this.logger.warn(`refresh: invalid or expired refresh token`);
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const refreshTypeId = await this.resolveTokenTypeId("REFRESH");
    const stored = await this.prisma.token.findFirst({
      where: {
        userId: payload.sub,
        typeId: refreshTypeId,
        token: dto.refreshToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      this.logger.warn(`refresh: token revoked or not found user=${payload.sub}`);
      throw new UnauthorizedException("Refresh token revoked or not found");
    }

    await this.prisma.token.update({ where: { id: stored.id }, data: { used: true } });

    this.logger.log(`refresh: token rotated user=${payload.sub}`);
    const tokens = await this.issueTokenPair(payload.sub, payload.identifier);
    return ok(TOKEN_REFRESHED, tokens);
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.resolveByIdentifier(dto.identifier);

    if (user) {
      await this.invalidateOtps(user.id, "PASSWORD_RESET");
      const otp = this.generateOtp();
      await this.storeToken(user.id, otp, "PASSWORD_RESET");

      if (user.email) {
        this.notifications.sendPasswordResetOtp(user.email, otp);
        this.logger.log(`forgotPassword: reset OTP sent via email user=${user.id}`);
      } else if (user.phoneNumber) {
        this.notifications.sendPhoneOtp(user.phoneNumber, otp);
        this.logger.log(`forgotPassword: reset OTP sent via SMS user=${user.id}`);
      }
    } else {
      this.logger.warn(`forgotPassword: no account for identifier=${dto.identifier}`);
    }

    return ok(PASSWORD_RESET_OTP_SENT);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.resolveByIdentifier(dto.identifier);

    const invalid = new UnauthorizedException(INVALID_OTP);
    if (!user) {
      this.logger.warn(`resetPassword: user not found identifier=${dto.identifier}`);
      throw invalid;
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }

    const typeId = await this.resolveTokenTypeId("PASSWORD_RESET");
    const token = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        typeId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token || token.token !== dto.otp) {
      this.logger.warn(`resetPassword: invalid or expired OTP user=${user.id}`);
      throw invalid;
    }

    await this.prisma.token.update({ where: { id: token.id }, data: { used: true } });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.users.setPassword(user.id, passwordHash);
    this.logger.log(`resetPassword: password reset user=${user.id}`);

    return ok(PASSWORD_RESET);
  }

  // ─── Change Password (authenticated) ─────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Passwords do not match");
    }

    const user = await this.users.findById(userId);
    if (!user || !user.passwordHash) {
      throw new BadRequestException("No password set on this account");
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      this.logger.warn(`changePassword: wrong current password user=${userId}`);
      throw new UnauthorizedException(INVALID_PASSWORD);
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.users.setPassword(userId, passwordHash);
    this.logger.log(`changePassword: password changed user=${userId}`);

    return ok(CHANGE_PASSWORD);
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────

  async resendOtp(dto: SignupDto) {
    const user = dto.phone
      ? await this.users.findByPhone(normalizeNigerianPhone(dto.phone))
      : await this.users.findByEmail(dto.email!.toLowerCase());

    if (user && !user.passwordHash) {
      await this.invalidateOtps(user.id, "OTP");
      const otp = this.generateOtp();
      await this.storeToken(user.id, otp, "OTP");

      if (user.phoneNumber) {
        await this.notifications.sendPhoneOtp(user.phoneNumber, otp);
        this.logger.log(`resendOtp: OTP resent via SMS user=${user.id}`);
      } else {
        this.notifications.sendEmailOtp(user.email!, otp);
        this.logger.log(`resendOtp: OTP resent via email user=${user.id}`);
      }

      return ok(VERIFICATION_OTP_RESENT, { otp });
    }

    this.logger.log(`resendOtp: no-op (user not found or already registered)`);
    return ok(VERIFICATION_OTP_RESENT);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async sendDeviceVerifyOtp(user: User, fcmToken: string | null): Promise<string> {
    await this.invalidateOtps(user.id, "DEVICE_VERIFY");
    const otp = this.generateOtp();
    const typeId = await this.resolveTokenTypeId("DEVICE_VERIFY");
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.prisma.token.create({
      data: { id: generateId("tok"), userId: user.id, typeId, token: otp, expiresAt },
    });

    if (user.phoneNumber) {
      this.notifications.sendPhoneOtp(user.phoneNumber, otp);
      this.logger.log(`sendDeviceVerifyOtp: OTP sent via SMS user=${user.id}`);
    } else {
      this.notifications.sendEmailOtp(user.email!, otp);
      this.logger.log(`sendDeviceVerifyOtp: OTP sent via email user=${user.id}`);
    }

    return otp;
  }

  private async resolveByIdentifier(identifier: string): Promise<User | null> {
    if (isEmail(identifier)) {
      return this.users.findByEmail(identifier.toLowerCase());
    }
    return this.users.findByPhone(normalizeNigerianPhone(identifier));
  }

  private generateOtp(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  private async resolveTokenTypeId(name: string): Promise<number> {
    const type = await this.prisma.tokenType.findUniqueOrThrow({ where: { name } });
    return type.id;
  }

  private async storeToken(userId: string, token: string, typeName: string): Promise<void> {
    const typeId = await this.resolveTokenTypeId(typeName);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.prisma.token.create({
      data: { id: generateId("tok"), userId, typeId, token, expiresAt },
    });
  }

  private async invalidateOtps(userId: string, typeName: string): Promise<void> {
    const typeId = await this.resolveTokenTypeId(typeName);
    await this.prisma.token.updateMany({
      where: { userId, typeId, used: false },
      data: { used: true },
    });
  }

  private signAccess(
    userId: string,
    identifier: string,
    type: "access" | "onboarding" = "access",
    ttl?: string,
  ): string {
    return this.jwt.sign(
      { sub: userId, identifier, type },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: ttl ?? this.config.get<string>("JWT_ACCESS_TTL"),
      },
    );
  }

  private async issueTokenPair(
    userId: string,
    identifier: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.signAccess(userId, identifier);

    const refreshToken = this.jwt.sign(
      { sub: userId, identifier },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_TTL"),
      },
    );

    const refreshTypeId = await this.resolveTokenTypeId("REFRESH");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.token.create({
      data: {
        id: generateId("tok"),
        userId,
        typeId: refreshTypeId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
