import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailProvider {
    private readonly logger = new Logger(EmailProvider.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly senderEmail: string;

    constructor(private readonly config: ConfigService) {
        this.senderEmail = this.config.get<string>('MAIL_FROM')!;

        this.transporter = nodemailer.createTransport({
            host: this.config.get<string>('MAIL_HOST'),
            port: this.config.get<number>('MAIL_PORT'),
            secure: false,
            auth: {
                user: this.config.get<string>('MAIL_USER'),
                pass: this.config.get<string>('MAIL_PASS'),
            },
        });
    }

    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        try {
            await this.transporter.sendMail({
                from: this.senderEmail,
                to,
                subject,
                html: body,
            });
        } catch (err) {
            this.logger.error({ err, to }, 'Email delivery failed');
            throw new InternalServerErrorException('Failed to send email');
        }
    }
}