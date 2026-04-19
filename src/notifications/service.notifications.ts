import { Injectable } from '@nestjs/common';
import { TermiiProvider } from './providers/termii.provider';

@Injectable()
export class NotificationsService {
  constructor(private readonly termii: TermiiProvider) {}

  sendOtp(phone: string, otp: string): Promise<void> {
    return this.termii.sendSms(phone, `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`);
  }
}
