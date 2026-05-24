import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma-client/prisma.service";
import { NotificationsService } from "@notifications/service.notifications";
import { generateId } from "@common/lib/utils/util.id";
import { normalizeNigerianPhone } from "@common/lib/utils/util.phone";
import { ok } from "@common/lib/utils/util.response";
import { JoinWaitlistDto } from "./lib/dto/dto.waitlist.join";

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async join(dto: JoinWaitlistDto) {
    const emailLower = dto.email.toLowerCase();
    const phone = dto.phoneNumber
      ? normalizeNigerianPhone(dto.phoneNumber)
      : undefined;

    const existing = await this.prisma.waitlist.findFirst({
      where: { OR: [{ email: emailLower }, ...(phone ? [{ phoneNumber: phone }] : [])] },
    });

    if (existing) {
      this.logger.warn(`join: already on waitlist email=${emailLower}`);
      throw new ConflictException("You are already on the waitlist");
    }

    await this.prisma.waitlist.create({
      data: {
        id: generateId("wl"),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: emailLower,
        phoneNumber: phone ?? null,
        hearAboutUs: dto.hearAboutUs,
      },
    });

    this.notifications.sendWaitlistConfirmation(emailLower, dto.firstName);
    this.logger.log(`join: email=${emailLower}`);

    return ok("You're on the waitlist! Check your email for confirmation.");
  }
}
