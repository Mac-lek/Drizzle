import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import IORedis from 'ioredis';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DisbursementModule } from './disbursement/disbursement.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: 'info' },
    }),
    AppConfigModule,
    PrismaModule,
    NotificationsModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.get<string>('REDIS_URL')!, {
          maxRetriesPerRequest: null,
        }),
      }),
      inject: [ConfigService],
    }),
    DisbursementModule,
  ],
})
export class WorkerModule { }
