import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './service.auth';
import { UsersService } from '@users/service.users';
import { NotificationsService } from '@notifications/service.notifications';
import { PrismaService } from '@prisma-client/prisma.service';

const mockUser = {
  id: 'user-1',
  phoneNumber: '+2348012345678',
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

const mockActiveUser = {
  ...mockUser,
  pinHash: '$argon2id$test-hash',
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByPhone: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findOrCreate: jest.fn(),
            setPin: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendPhoneOtp: jest.fn().mockResolvedValue(undefined),
            sendEmailOtp: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            tokenType: { findUniqueOrThrow: jest.fn() },
            token: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            userStatus: { findUnique: jest.fn() },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    notificationsService = module.get(NotificationsService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Default token type resolution
    (prisma.tokenType.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 1, name: 'OTP' });
    (prisma.token.create as jest.Mock).mockResolvedValue({});
  });

  // ─── signup ───────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('creates a new user and sends OTP', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue({ user: mockUser, created: true });

      const result = await service.signup({ phone: '08012345678' });

      expect(usersService.findOrCreate).toHaveBeenCalledWith('+2348012345678', undefined);
      expect(notificationsService.sendPhoneOtp).toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('silently succeeds without sending OTP when user already has a PIN', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue({
        user: mockActiveUser,
        created: false,
      });

      const result = await service.signup({ phone: '08012345678' });

      expect(notificationsService.sendPhoneOtp).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('passes email to findOrCreate when provided', async () => {
      (usersService.findOrCreate as jest.Mock).mockResolvedValue({ user: mockUser, created: true });

      await service.signup({ phone: '08012345678', email: 'user@example.com' });

      expect(usersService.findOrCreate).toHaveBeenCalledWith('+2348012345678', 'user@example.com');
    });
  });

  // ─── verifyOtp ────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('verifies a valid OTP and returns an access token', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser);
      (prisma.token.findFirst as jest.Mock).mockResolvedValue({
        id: 'token-1',
        token: '123456',
        used: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.token.update as jest.Mock).mockResolvedValue({});

      const result = await service.verifyOtp({ identifier: '08012345678', otp: '123456' });

      expect(prisma.token.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-1' }, data: { used: true } }),
      );
      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException when phone is not found', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp({ identifier: '08012345678', otp: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when OTP does not match', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser);
      (prisma.token.findFirst as jest.Mock).mockResolvedValue({
        id: 'token-1',
        token: '999999',
      });

      await expect(service.verifyOtp({ identifier: '08012345678', otp: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when no valid OTP token exists', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser);
      (prisma.token.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp({ identifier: '08012345678', otp: '123456' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── setPin ───────────────────────────────────────────────────────────────

  describe('setPin', () => {
    it('hashes the PIN and returns a token pair', async () => {
      (prisma.tokenType.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'REFRESH',
      });
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.setPin('user-1', { pin: '1234' });

      expect(usersService.setPin).toHaveBeenCalledWith(
        'user-1',
        expect.stringMatching(/^\$argon2/),
      );
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    beforeEach(() => {
      (prisma.userStatus.findUnique as jest.Mock).mockResolvedValue({ id: 1, name: 'ACTIVE' });
      (prisma.tokenType.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'REFRESH',
      });
    });

    it('logs in successfully with phone identifier', async () => {
      const pinHash = await argon2.hash('1234', { type: argon2.argon2id });
      const user = { ...mockActiveUser, pinHash };
      (usersService.findByPhone as jest.Mock).mockResolvedValue(user);

      const result = await service.login({ identifier: '08012345678', pin: '1234' });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('logs in successfully with email identifier', async () => {
      const pinHash = await argon2.hash('1234', { type: argon2.argon2id });
      const user = { ...mockActiveUser, email: 'user@example.com', pinHash };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);

      const result = await service.login({ identifier: 'user@example.com', pin: '1234' });

      expect(usersService.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(result.accessToken).toBeDefined();
    });

    it('throws UnauthorizedException for unknown identifier', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(null);

      await expect(service.login({ identifier: '08099999999', pin: '1234' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for wrong PIN', async () => {
      const pinHash = await argon2.hash('1234', { type: argon2.argon2id });
      const user = { ...mockActiveUser, pinHash };
      (usersService.findByPhone as jest.Mock).mockResolvedValue(user);

      await expect(service.login({ identifier: '08012345678', pin: '0000' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when user is not ACTIVE', async () => {
      const pinHash = await argon2.hash('1234', { type: argon2.argon2id });
      const user = { ...mockActiveUser, pinHash };
      (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
      (prisma.userStatus.findUnique as jest.Mock).mockResolvedValue({ id: 2, name: 'SUSPENDED' });

      await expect(service.login({ identifier: '08012345678', pin: '1234' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws UnauthorizedException when user has no PIN set', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser); // pinHash: null

      await expect(service.login({ identifier: '08012345678', pin: '1234' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotates refresh token and issues a new pair', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-1',
        phone: '+2348012345678',
      });
      (prisma.tokenType.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'REFRESH',
      });
      (prisma.token.findFirst as jest.Mock).mockResolvedValue({ id: 'tok-1' });
      (prisma.token.update as jest.Mock).mockResolvedValue({});

      const result = await service.refresh({ refreshToken: 'old-token' });

      expect(prisma.token.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tok-1' }, data: { used: true } }),
      );
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws UnauthorizedException when JWT is invalid', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refresh({ refreshToken: 'bad-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token is not found in DB', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-1', phone: '+2348012345678' });
      (prisma.tokenType.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'REFRESH',
      });
      (prisma.token.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'revoked-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── resendOtp ────────────────────────────────────────────────────────────

  describe('resendOtp', () => {
    it('resends OTP for an unverified user', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser);
      (prisma.token.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.resendOtp({ phone: '08012345678' });

      expect(prisma.token.updateMany).toHaveBeenCalled();
      expect(notificationsService.sendPhoneOtp).toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('silently succeeds for an unknown phone', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(null);

      const result = await service.resendOtp({ phone: '08099999999' });

      expect(notificationsService.sendPhoneOtp).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('silently succeeds for a fully registered phone', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockActiveUser);

      const result = await service.resendOtp({ phone: '08012345678' });

      expect(notificationsService.sendPhoneOtp).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });
  });
});
