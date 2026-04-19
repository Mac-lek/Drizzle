import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './service.users';
import { PrismaService } from '@prisma-client/prisma.service';

const mockKycStatus = { id: 1, name: 'NONE', label: 'None' };
const mockUserStatus = { id: 1, name: 'ACTIVE', label: 'Active' };

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

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            kycStatus: { findUniqueOrThrow: jest.fn().mockResolvedValue(mockKycStatus) },
            userStatus: { findUniqueOrThrow: jest.fn().mockResolvedValue(mockUserStatus) },
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.findById('unknown');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('looks up by email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await service.findByEmail('user@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });
  });

  describe('findOrCreate', () => {
    it('returns existing user without creating a new one', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const { user, created } = await service.findOrCreate('08012345678');

      expect(created).toBe(false);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('normalizes the phone number to E.164', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.findOrCreate('08012345678');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phoneNumber: '+2348012345678' },
      });
    });

    it('creates a new user with wallet when phone is not registered', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const { user, created } = await service.findOrCreate('08012345678');

      expect(created).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: '+2348012345678',
            wallet: { create: {} },
          }),
        }),
      );
    });

    it('includes email when provided', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, email: 'u@example.com' });

      await service.findOrCreate('08012345678', 'u@example.com');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'u@example.com' }),
        }),
      );
    });
  });

  describe('setPin', () => {
    it('updates the user pinHash', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.setPin('user-1', 'hashed-pin');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pinHash: 'hashed-pin' },
      });
    });
  });

  describe('updateProfile', () => {
    it('updates only provided fields', async () => {
      const updated = { ...mockUser, firstName: 'Ada' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', { firstName: 'Ada' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firstName: 'Ada' },
        }),
      );
      expect(result.firstName).toBe('Ada');
    });

    it('does not include undefined fields in the update payload', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await service.updateProfile('user-1', { firstName: 'Ada' });

      const call = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
      expect(call?.data).not.toHaveProperty('email');
      expect(call?.data).not.toHaveProperty('lastName');
    });
  });
});
