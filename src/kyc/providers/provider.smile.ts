import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmileProvider {
  private readonly logger = new Logger(SmileProvider.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async createVerificationLink(userId: string, jobId: string): Promise<string> {
    const baseUrl = this.config.getOrThrow<string>('SMILE_BASE_URL');
    const partnerId = this.config.getOrThrow<string>('SMILE_PARTNER_ID');
    const apiKey = this.config.getOrThrow<string>('SMILE_API_KEY');
    const callbackUrl = this.config.getOrThrow<string>('SMILE_CALLBACK_URL');

    const timestamp = new Date().toISOString();
    const signature = this.sign(timestamp, partnerId, apiKey);

    const response = await firstValueFrom(
      this.http.post(`${baseUrl}/v1/smile_links`, {
        partner_id: partnerId,
        timestamp,
        signature,
        callback_url: callbackUrl,
        partner_params: { user_id: userId, job_id: jobId, job_type: 1 },
        id_info: { country: 'NG' },
      }),
    );

    return response.data.link as string;
  }

  verifyWebhookSignature(timestamp: string, partnerId: string, signature: string): void {
    const apiKey = this.config.getOrThrow<string>('SMILE_API_KEY');
    const expected = this.sign(timestamp, partnerId, apiKey);
    if (expected !== signature) {
      throw new UnauthorizedException('Invalid Smile webhook signature');
    }
  }

  private sign(timestamp: string, partnerId: string, apiKey: string): string {
    return createHmac('sha256', apiKey)
      .update(timestamp + partnerId)
      .digest('base64');
  }
}
