import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { envValidationSchema } from './config/env.validation';
// import { KycModule } from './kyc/kyc.module';
// import { WalletModule } from './wallet/wallet.module';
// import { VaultModule } from './vault/vault.module';
// import { DisbursementModule } from './disbursement/disbursement.module';
// import { LedgerModule } from './ledger/ledger.module';
// import { PaymentsModule } from './payments/payments.module';
// import { ReconciliationModule } from './reconciliation/reconciliation.module';
// import { AdminModule } from './admin/admin.module';
// import { HealthModule } from './health/health.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: envValidationSchema.validate({ NODE_ENV: process.env.NODE_ENV }).value.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          envValidationSchema.validate({ NODE_ENV: process.env.NODE_ENV }).value.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    // KycModule,
    // WalletModule,
    // VaultModule,
    // DisbursementModule,
    // LedgerModule,
    // PaymentsModule,
    // ReconciliationModule,
    // AdminModule,
    // HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule { }
