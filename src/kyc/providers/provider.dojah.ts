import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface DojahBvnResult {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string;
}

@Injectable()
export class DojahProvider {
  private readonly logger = new Logger(DojahProvider.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async verifyBvn(bvn: string): Promise<DojahBvnResult> {
    const baseUrl = this.config.getOrThrow<string>('DOJAH_BASE_URL');
    const appId = this.config.getOrThrow<string>('DOJAH_APP_ID');
    const secretKey = this.config.getOrThrow<string>('DOJAH_SECRET_KEY');

    try {
      const response = await firstValueFrom(
        this.http.get(`${baseUrl}/api/v1/kyc/bvn`, {
          params: { bvn },
          headers: { AppId: appId, Authorization: secretKey },
        }),
      );

      const entity = response.data?.entity;
      if (!entity) throw new UnprocessableEntityException('BVN not found');

      return {
        firstName: entity.first_name ?? '',
        lastName: entity.last_name ?? '',
        dateOfBirth: entity.date_of_birth ?? '',
        phoneNumber: entity.phone_number1 ?? '',
      };
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.data?.error) {
        throw new UnprocessableEntityException('BVN could not be verified');
      }
      this.logger.error({ bvn: '***', error }, 'Dojah BVN lookup failed');
      throw error;
    }
  }
}
