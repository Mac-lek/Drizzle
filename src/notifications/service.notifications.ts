import { Injectable, Logger } from "@nestjs/common";
import { TermiiProvider } from "./providers/termii.provider";
import { EmailProvider } from "./providers/nodemailer.provider";
import { buildEmailHtml } from "./lib/templates";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider,
  ) {}

  sendPhoneOtp(phone: string, otp: string): void {
    this.termii
      .sendSms(phone, `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`)
      .catch((err) => this.logger.error(err, `Failed to send OTP SMS to ${phone}`));
  }

  sendEmailOtp(to: string, otp: string): void {
    this.send(to, "Your Drizzle Verification Code", buildEmailHtml({ type: "otp", data: { otp } }));
  }

  sendAdminOtp(to: string, otp: string): void {
    this.send(to, "Drizzle Admin — Your Login OTP", buildEmailHtml({ type: "adminOtp", data: { otp } }));
  }

  sendAdminInvite(to: string, role: string, token: string, expiresIn: string): void {
    this.send(to, "You're Invited to Drizzle Admin", buildEmailHtml({ type: "adminInvite", data: { role, token, expiresIn } }));
  }

  sendWaitlistConfirmation(to: string, firstName: string): void {
    this.send(to, "You're on the Drizzle Waitlist!", buildEmailHtml({ type: "waitlist", data: { firstName } }));
  }

  private send(to: string, subject: string, html: string): void {
    this.email
      .sendEmail(to, subject, html)
      .catch((err) => this.logger.error(err, `Failed to send email to ${to}`));
  }
}
