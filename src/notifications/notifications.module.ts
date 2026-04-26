import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TermiiProvider } from './providers/termii.provider';
import { EmailProvider } from './providers/nodemailer.provider';
import { NotificationsService } from './service.notifications';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [TermiiProvider, EmailProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
