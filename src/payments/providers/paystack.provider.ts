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

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
}

export interface PaystackDedicatedAccount {
  account_number: string;
  account_name: string;
  bank: { name: string; id: number; slug: string };
  customer: { customer_code: string };
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

  async createCustomer(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<PaystackCustomer> {
    const { data } = await this.http.post('/customer', {
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone,
    });
    return data.data as PaystackCustomer;
  }

  async createDedicatedVirtualAccount(
    customerCode: string,
    preferredBank: string,
  ): Promise<PaystackDedicatedAccount> {
    const { data } = await this.http.post('/dedicated_account', {
      customer: customerCode,
      preferred_bank: preferredBank,
    });
    return data.data as PaystackDedicatedAccount;
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const hash = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }
}
