import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';

export interface PaystackTransactionInit {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackTransactionVerify {
  status: string;
  amount: number;
  reference: string;
  channel: string;
  customer: { email: string; customer_code: string };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaystackProvider {
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly http: AxiosInstance;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.secretKey = config.get<string>('PAYSTACK_SECRET_KEY')!;
    this.http = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initializeTransaction(params: {
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
    callback_url?: string;
  }): Promise<PaystackTransactionInit> {
    const { data } = await this.http.post('/transaction/initialize', params);
    return data.data as PaystackTransactionInit;
  }

  async verifyTransaction(reference: string): Promise<PaystackTransactionVerify> {
    const { data } = await this.http.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    return data.data as PaystackTransactionVerify;
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const hash = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }
}
