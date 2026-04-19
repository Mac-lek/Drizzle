import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '@prisma-client/prisma.service';
import { UsersService } from '@users/service.users';
import { NotificationsService } from '@notifications/service.notifications';
import { normalizeNigerianPhone } from '@common/lib/utils/util.phone';
import {
  VERIFICATION_OTP_SENT,
  VERIFICATION_OTP_RESENT,
  INVALID_OTP,
  INVALID_PIN,
  CREATE_PIN,
  USER_LOGIN_SUCCESSFULLY,
  ACCOUNT_DEACTIVATED,
} from '@common/lib/enums/lib.enum.messages';
import { SignupDto } from './lib/dto/dto.auth.signup';
import { VerifyOtpDto } from './lib/dto/dto.auth.verify-otp';
import { SetPinDto } from './lib/dto/dto.auth.set-pin';
import { LoginDto } from './lib/dto/dto.auth.login';
import { RefreshDto } from './lib/dto/dto.auth.refresh';
import { JwtPayload } from './strategies/jwt.strategy';

const OTP_TTL_MINUTES = 10;
const REFRESH_TTL_DAYS = 30;

// Matches a@b.c pattern — used to distinguish email from phone identifier
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<{ message: string }> {
    const phone = normalizeNigerianPhone(dto.phone);
    const { user } = await this.users.findOrCreate(phone, dto.email);

    // Only send OTP if user hasn't completed registration.
    // Silently succeed for fully-registered phones to avoid enumeration.
    if (!user.pinHash) {
      const otp = this.generateOtp();
      await this.storeOtp(user.id, otp);
      await this.notifications.sendOtp(phone, otp);
    }

    return { message: VERIFICATION_OTP_SENT };
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string; accessToken: string }> {
    const phone = normalizeNigerianPhone(dto.phone);
    const user = await this.users.findByPhone(phone);

    // Generic error — never reveal whether phone is registered
    const invalid = new UnauthorizedException(INVALID_OTP);

    if (!user) throw invalid;

    const otpTypeId = await this.resolveTokenTypeId('OTP');
    const token = await this.prisma.token.findFirst({
      where: {
        userId: user.id,
        typeId: otpTypeId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || token.token !== dto.otp) throw invalid;

    await this.prisma.token.update({ where: { id: token.id }, data: { used: true } });

    const accessToken = this.signAccess(user.id, user.phoneNumber);
    return { message: 'OTP verified successfully', accessToken };
  }

  // ─── Set PIN ──────────────────────────────────────────────────────────────

  async setPin(
    userId: string,
    dto: SetPinDto,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
    await this.users.setPin(userId, pinHash);

    const user = await this.users.findById(userId);
    const { accessToken, refreshToken } = await this.issueTokenPair(user!.id, user!.phoneNumber);

    return { message: CREATE_PIN, accessToken, refreshToken };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    const user = await this.resolveByIdentifier(dto.identifier);

    // Generic error — never reveal whether identifier is registered
    const invalid = new UnauthorizedException(INVALID_PIN);

    if (!user || !user.pinHash) throw invalid;

    const statusName = await this.prisma.userStatus
      .findUnique({ where: { id: user.statusId } })
      .then((s) => s?.name);

    if (statusName !== 'ACTIVE') throw new ForbiddenException(ACCOUNT_DEACTIVATED);

    const valid = await argon2.verify(user.pinHash, dto.pin);
    if (!valid) throw invalid;

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, user.phoneNumber);
    return { message: USER_LOGIN_SUCCESSFULLY, accessToken, refreshToken };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const refreshTypeId = await this.resolveTokenTypeId('REFRESH');
    const stored = await this.prisma.token.findFirst({
      where: {
        userId: payload.sub,
        typeId: refreshTypeId,
        token: dto.refreshToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) throw new UnauthorizedException('Refresh token revoked or not found');

    // Rotate: invalidate old token before issuing new pair
    await this.prisma.token.update({ where: { id: stored.id }, data: { used: true } });

    return this.issueTokenPair(payload.sub, payload.phone);
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────

  async resendOtp(dto: SignupDto): Promise<{ message: string }> {
    const phone = normalizeNigerianPhone(dto.phone);
    const user = await this.users.findByPhone(phone);

    // Always return success — do not reveal registration status
    if (user && !user.pinHash) {
      await this.invalidateOtps(user.id);
      const otp = this.generateOtp();
      await this.storeOtp(user.id, otp);
      await this.notifications.sendOtp(phone, otp);
    }

    return { message: VERIFICATION_OTP_RESENT };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async resolveByIdentifier(identifier: string): Promise<User | null> {
    if (EMAIL_PATTERN.test(identifier)) {
      return this.users.findByEmail(identifier.toLowerCase());
    }
    const phone = normalizeNigerianPhone(identifier);
    return this.users.findByPhone(phone);
  }

  private generateOtp(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  private async resolveTokenTypeId(name: string): Promise<number> {
    const type = await this.prisma.tokenType.findUniqueOrThrow({ where: { name } });
    return type.id;
  }

  private async storeOtp(userId: string, otp: string): Promise<void> {
    const typeId = await this.resolveTokenTypeId('OTP');
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.prisma.token.create({ data: { userId, typeId, token: otp, expiresAt } });
  }

  private async invalidateOtps(userId: string): Promise<void> {
    const typeId = await this.resolveTokenTypeId('OTP');
    await this.prisma.token.updateMany({
      where: { userId, typeId, used: false },
      data: { used: true },
    });
  }

  private signAccess(userId: string, phone: string): string {
    return this.jwt.sign(
      { sub: userId, phone },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL'),
      },
    );
  }

  private async issueTokenPair(
    userId: string,
    phone: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.signAccess(userId, phone);

    const refreshToken = this.jwt.sign(
      { sub: userId, phone },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL'),
      },
    );

    const refreshTypeId = await this.resolveTokenTypeId('REFRESH');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.token.create({
      data: { userId, typeId: refreshTypeId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
