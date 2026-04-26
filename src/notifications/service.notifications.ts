import { Injectable } from '@nestjs/common';
import { TermiiProvider } from './providers/termii.provider';
import { EmailProvider } from './providers/nodemailer.provider';

@Injectable()
export class NotificationsService {

  constructor(
    private readonly termii: TermiiProvider,
    private readonly email: EmailProvider
  ) { }

  sendPhoneOtp(phone: string, otp: string): Promise<void> {
    return this.termii.sendSms(phone, `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`);
  }

  sendEmailOtp(email: string, otp: string): Promise<void> {
    return this.email.sendEmail(email, 'Drizzle Verification OTP', `Your Drizzle verification code is ${otp}. Valid for 10 minutes. Do not share.`);
  }
}
