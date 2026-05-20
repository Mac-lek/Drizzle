import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>("MAIL_HOST"),
      port: this.config.getOrThrow<number>("MAIL_PORT"),
      secure: this.config.get<number>("MAIL_PORT") === 465,
      auth: {
        user: this.config.getOrThrow<string>("MAIL_USER"),
        pass: this.config.getOrThrow<string>("MAIL_PASS"),
      },
    });
    this.from = this.config.getOrThrow<string>("MAIL_FROM");
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, html: body });
  }
}
