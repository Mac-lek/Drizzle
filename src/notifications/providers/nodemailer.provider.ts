import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>("RESEND_API_KEY"));
    this.from = this.config.getOrThrow<string>("MAIL_FROM");
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html: body,
    });

    if (error) {
      this.logger.error({ error, to }, "Email delivery failed");
      throw new Error(error.message);
    }
  }
}
