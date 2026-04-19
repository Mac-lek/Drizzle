import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TermiiProvider } from './providers/termii.provider';
import { NotificationsService } from './service.notifications';

@Module({
  imports: [HttpModule],
  providers: [TermiiProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
