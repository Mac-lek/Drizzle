import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma-client/prisma.service";
import { generateId } from "@common/lib/utils/util.id";
import { SmileProvider } from "./providers/provider.smile";
import { ok } from "@common/lib/utils/util.response";
import { KYC_STATUS_FETCHED, KYC_INITIATED } from "@common/lib/enums/lib.enum.messages";

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
    private readonly smile: SmileProvider,
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { kycStatus: { select: { name: true } } },
    });
    return ok(KYC_STATUS_FETCHED, { kycStatus: user.kycStatus.name });
  }

  async initiate(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bvnVerified: true, kycStatus: { select: { name: true } } },
    });

    if (!user.bvnVerified) {
      throw new ConflictException("BVN must be verified before initiating KYC");
    }

    const currentStatus = user.kycStatus.name;
    if (currentStatus === "PENDING" || currentStatus === "VERIFIED") {
      throw new ConflictException(`KYC is already ${currentStatus}`);
    }

    const pendingStatus = await this.prisma.kycStatus.findUniqueOrThrow({
      where: { name: "PENDING" },
    });

    const jobId = generateId("kyc");
    const url = await this.smile.createVerificationLink(userId, jobId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { kycStatusId: pendingStatus.id },
    });

    this.logger.log({ userId, jobId }, "KYC initiated");
    return ok(KYC_INITIATED, { url });
  }

  async handleSmileCallback(body: SmileWebhookBody): Promise<void> {
    this.smile.verifyWebhookSignature(
      body.timestamp,
      body.partner_id,
      body.signature,
    );

    const jobId = body.PartnerParams.job_id;
    const userId = body.PartnerParams.user_id;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId: jobId },
    });
    if (existing?.processed) return;

    await this.prisma.webhookEvent.upsert({
      where: { eventId: jobId },
      create: {
        id: generateId("evt"),
        provider: "smile",
        eventId: jobId,
        eventType: `kyc.${body.ResultCode}`,
        payload: body as object,
      },
      update: {},
    });

    const statusName = body.ResultCode === "1012" ? "VERIFIED" : "FAILED";

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

    this.logger.log({ userId, jobId, statusName }, "Smile webhook processed");
  }
}
