import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TermiiProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('TERMII_BASE_URL')!;
    this.apiKey = this.config.get<string>('TERMII_API_KEY')!;
    this.senderId = this.config.get<string>('TERMII_SENDER_ID')!;
  }

  async sendSms(to: string, message: string): Promise<void> {
    // Strip leading + for Termii (accepts 2348xxxxxxxx)
    const recipient = to.replace(/^\+/, '');

    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/sms/send`, {
          to: recipient,
          from: this.senderId,
          sms: message,
          type: 'plain',
          channel: 'dnd',
          api_key: this.apiKey,
        }),
      );
    } catch (err) {
      this.logger.error({ err, to }, 'Termii SMS delivery failed');
      throw new InternalServerErrorException('Failed to send SMS');
    }
  }
}
