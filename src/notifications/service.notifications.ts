import { Injectable, Logger } from "@nestjs/common";
import { TermiiProvider } from "./providers/termii.provider";
import { EmailProvider } from "./providers/nodemailer.provider";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider,
  ) {}

  sendPhoneOtp(phone: string, otp: string): void {
    this.termii
      .sendSms(
        phone,
        `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`,
      )
      .catch((err) => this.logger.error(err, `Failed to send OTP SMS to ${phone}`));
  }

  sendEmailOtp(to: string, otp: string): void {
    this.email
      .sendEmail(
        to,
        "Drizzle Verification OTP",
        `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`,
      )
      .catch((err) => this.logger.error(err, `Failed to send OTP email to ${to}`));
  }
}
