import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { DisbursementModule } from './disbursement/disbursement.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: 'info' },
    }),
    AppConfigModule,
    PrismaModule,
    DisbursementModule,
    NotificationsModule,
    ReconciliationModule,
  ],
})
export class WorkerModule {}
