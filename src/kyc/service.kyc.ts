import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma-client/prisma.service';
import { DojahProvider } from './providers/provider.dojah';
import { SubmitBvnDto } from './lib/dto/dto.kyc.tier1';
import { encryptBvn } from './lib/util.bvn-encrypt';

const RETRYABLE_STATUSES = new Set(['NONE', 'FAILED']);

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dojah: DojahProvider,
    private readonly config: ConfigService,
  ) {}

  async getStatus(userId: string): Promise<{ kycStatus: string; bvnVerified: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bvnVerified: true, kycStatus: { select: { name: true } } },
    });
    return { kycStatus: user.kycStatus.name, bvnVerified: user.bvnVerified };
  }

  async submitTier1(userId: string, dto: SubmitBvnDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        kycStatus: { select: { name: true } },
        bvnVerified: true,
      },
    });

    if (!RETRYABLE_STATUSES.has(user.kycStatus.name)) {
      throw new ConflictException(`KYC is already ${user.kycStatus.name}`);
    }

    if (!user.firstName || !user.lastName) {
      throw new BadRequestException('Complete your profile (first and last name) before KYC');
    }

    const [tier1VerifiedStatus, failedStatus] = await Promise.all([
      this.prisma.kycStatus.findUniqueOrThrow({ where: { name: 'TIER_1_VERIFIED' } }),
      this.prisma.kycStatus.findUniqueOrThrow({ where: { name: 'FAILED' } }),
    ]);

    try {
      await this.dojah.verifyBvn(dto.bvn);

      const encryptionKey = this.config.getOrThrow<string>('BVN_ENCRYPTION_KEY');
      const bvnEncrypted = encryptBvn(dto.bvn, encryptionKey);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          bvnEncrypted,
          bvnVerified: true,
          kycStatusId: tier1VerifiedStatus.id,
        },
      });

      this.logger.log({ userId }, 'Tier 1 KYC verified');
    } catch (error) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { kycStatusId: failedStatus.id },
      });
      throw error;
    }
  }
}
