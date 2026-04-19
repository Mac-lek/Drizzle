import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: 'info' },
    }),
    AppConfigModule,
    PrismaModule,
    NotificationsModule,
  ],
})
export class WorkerModule { }
