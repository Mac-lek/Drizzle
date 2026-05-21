import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma-client/prisma.service";
import { EmailProvider } from "@notifications/providers/nodemailer.provider";
import { generateId } from "@common/lib/utils/util.id";
import { normalizeNigerianPhone } from "@common/lib/utils/util.phone";
import { ok } from "@common/lib/utils/util.response";
import { JoinWaitlistDto } from "./lib/dto/dto.waitlist.join";

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
  ) {}

  async join(dto: JoinWaitlistDto) {
    const emailLower = dto.email.toLowerCase();
    const phone = dto.phoneNumber
      ? normalizeNigerianPhone(dto.phoneNumber)
      : undefined;

    const existing = await this.prisma.waitlist.findFirst({
      where: { OR: [{ email: emailLower }, ...(phone ? [{ phoneNumber: phone }] : [])] },
    });

    if (existing) throw new ConflictException("You are already on the waitlist");

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

    this.email
      .sendEmail(
        emailLower,
        "You're on the Drizzle waitlist!",
        `<p>Hi ${dto.firstName},</p>
<p>Thanks for joining the Drizzle waitlist! We're building a smarter way to save, and you'll be among the first to know when we launch.</p>
<p>We'll reach out as soon as a spot opens up.</p>
<p>— The Drizzle Team</p>`,
      )
      .catch((err) => this.logger.error(err, `Failed to send waitlist email to ${emailLower}`));

    return ok("You're on the waitlist! Check your email for confirmation.");
  }
}
