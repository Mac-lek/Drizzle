import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma-client/prisma.service';
import { generateId } from '@common/lib/utils/util.id';
import { DojahProvider } from './providers/provider.dojah';
import { SmileProvider } from './providers/provider.smile';
import { SubmitBvnDto } from './lib/dto/dto.kyc.tier1';
import { encryptBvn } from './lib/util.bvn-encrypt';

const TIER1_RETRYABLE = new Set(['NONE', 'FAILED']);

export interface SmileWebhookBody {
  partner_id: string;
  timestamp: string;
  signature: string;
  ResultCode: string;
  ResultText: string;
  PartnerParams: { user_id: string; job_id: string; job_type: number };
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dojah: DojahProvider,
    private readonly smile: SmileProvider,
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

    if (!TIER1_RETRYABLE.has(user.kycStatus.name)) {
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
        data: { bvnEncrypted, bvnVerified: true, kycStatusId: tier1VerifiedStatus.id },
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

  async initiateTier2(userId: string): Promise<{ url: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { kycStatus: { select: { name: true } } },
    });

    if (user.kycStatus.name !== 'TIER_1_VERIFIED') {
      throw new ConflictException('Tier 1 KYC must be completed before Tier 2');
    }

    const tier2PendingStatus = await this.prisma.kycStatus.findUniqueOrThrow({
      where: { name: 'TIER_2_PENDING' },
    });

    const jobId = generateId('kyc2');
    const url = await this.smile.createVerificationLink(userId, jobId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatusId: tier2PendingStatus.id },
    });

    this.logger.log({ userId, jobId }, 'Tier 2 KYC initiated');
    return { url };
  }

  async handleSmileCallback(body: SmileWebhookBody): Promise<void> {
    this.smile.verifyWebhookSignature(body.timestamp, body.partner_id, body.signature);

    const jobId = body.PartnerParams.job_id;
    const userId = body.PartnerParams.user_id;

    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId: jobId } });
    if (existing?.processed) return;

    await this.prisma.webhookEvent.upsert({
      where: { eventId: jobId },
      create: {
        id: generateId('evt'),
        provider: 'smile',
        eventId: jobId,
        eventType: `kyc.tier2.${body.ResultCode}`,
        payload: body as object,
      },
      update: {},
    });

    const isVerified = body.ResultCode === '1012';
    const statusName = isVerified ? 'TIER_2_VERIFIED' : 'FAILED';

    const kycStatus = await this.prisma.kycStatus.findUniqueOrThrow({
      where: { name: statusName },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatusId: kycStatus.id },
    });

    await this.prisma.webhookEvent.update({
      where: { eventId: jobId },
      data: { processed: true, processedAt: new Date() },
    });

    this.logger.log({ userId, jobId, statusName }, 'Smile webhook processed');
  }
}
