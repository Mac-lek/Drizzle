import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycService } from './service.kyc';
import { DojahProvider } from './providers/provider.dojah';
import { PrismaService } from '@prisma-client/prisma.service';
import { encryptBvn, decryptBvn } from './lib/util.bvn-encrypt';

const TEST_KEY = 'a'.repeat(64);

const mockUser = (kycStatusName: string, extras: object = {}) => ({
  firstName: 'John',
  lastName: 'Doe',
  bvnVerified: false,
  kycStatus: { name: kycStatusName },
  ...extras,
});

describe('KycService', () => {
  let service: KycService;
  let prisma: jest.Mocked<PrismaService>;
  let dojah: jest.Mocked<DojahProvider>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
            },
            kycStatus: { findUniqueOrThrow: jest.fn() },
          },
        },
        {
          provide: DojahProvider,
          useValue: { verifyBvn: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(KycService);
    prisma = module.get(PrismaService);
    dojah = module.get(DojahProvider);
    config = module.get(ConfigService);
  });

  describe('getStatus', () => {
    it('returns kycStatus and bvnVerified for user', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        bvnVerified: true,
        kycStatus: { name: 'TIER_1_VERIFIED' },
      });

      const result = await service.getStatus('usr_1');
      expect(result).toEqual({ kycStatus: 'TIER_1_VERIFIED', bvnVerified: true });
    });
  });

  describe('submitTier1', () => {
    it('verifies BVN, encrypts it, and sets TIER_1_VERIFIED', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockUser('NONE'));
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: 'JOHN', lastName: 'DOE', dateOfBirth: '1990-01-01', phoneNumber: '',
      });
      (config.getOrThrow as jest.Mock).mockReturnValue(TEST_KEY);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.submitTier1('usr_1', { bvn: '12345678901' });

      expect(dojah.verifyBvn).toHaveBeenCalledWith('12345678901');
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.bvnVerified).toBe(true);
      expect(updateCall.data.kycStatusId).toBe(3);
      expect(typeof updateCall.data.bvnEncrypted).toBe('string');
    });

    it('throws ConflictException if already TIER_1_VERIFIED', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockUser('TIER_1_VERIFIED'));
      await expect(service.submitTier1('usr_1', { bvn: '12345678901' })).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if profile is incomplete', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        mockUser('NONE', { firstName: null, lastName: null }),
      );
      await expect(service.submitTier1('usr_1', { bvn: '12345678901' })).rejects.toThrow(BadRequestException);
    });

    it('sets kycStatus to FAILED and re-throws when Dojah call fails', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockUser('NONE'));
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockRejectedValue(new Error('Dojah down'));
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(service.submitTier1('usr_1', { bvn: '12345678901' })).rejects.toThrow('Dojah down');

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.kycStatusId).toBe(6);
    });

    it('allows retry when previous attempt FAILED', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockUser('FAILED'));
      (prisma.kycStatus.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 6 });
      (dojah.verifyBvn as jest.Mock).mockResolvedValue({
        firstName: 'JOHN', lastName: 'DOE', dateOfBirth: '', phoneNumber: '',
      });
      (config.getOrThrow as jest.Mock).mockReturnValue(TEST_KEY);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await expect(service.submitTier1('usr_1', { bvn: '12345678901' })).resolves.not.toThrow();
    });
  });
});

describe('BVN encryption', () => {
  it('round-trips correctly', () => {
    const bvn = '12345678901';
    const encrypted = encryptBvn(bvn, TEST_KEY);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptBvn(encrypted, TEST_KEY)).toBe(bvn);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const bvn = '12345678901';
    expect(encryptBvn(bvn, TEST_KEY)).not.toBe(encryptBvn(bvn, TEST_KEY));
  });
});
