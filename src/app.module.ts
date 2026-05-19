import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import IORedis from "ioredis";
import { AppConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { envValidationSchema } from "./config/env.validation";
import { WalletModule } from "./wallet/wallet.module";
import { VaultModule } from "./vault/vault.module";
import { PaymentsModule } from "./payments/payments.module";
import { DisbursementModule } from "./disbursement/disbursement.module";
import { KycModule } from "./kyc/kyc.module";
import { AdminModule } from "./admin/admin.module";
// import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          envValidationSchema.validate({ NODE_ENV: process.env.NODE_ENV }).value
            .NODE_ENV !== "production"
            ? "debug"
            : "info",
        transport:
          envValidationSchema.validate({ NODE_ENV: process.env.NODE_ENV }).value
            .NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers['x-api-key']",
            "req.headers['user-agent']",
            "req.headers['sec-ch-ua']",
            "req.headers['sec-ch-ua-mobile']",
            "req.headers['sec-ch-ua-platform']",
            "req.headers['sec-fetch-site']",
            "req.headers['sec-fetch-mode']",
            "req.headers['sec-fetch-dest']",
            "req.headers['accept-encoding']",
            "req.headers['accept-language']",
            "req.headers.referer",
            "req.headers.origin",
          ],
          censor: "[redacted]",
        },
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
      },
    }),
    AppConfigModule,
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.get<string>("REDIS_URL")!, {
          maxRetriesPerRequest: null,
        }),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    NotificationsModule,
    WalletModule,
    VaultModule,
    PaymentsModule,
    DisbursementModule,
    KycModule,
    AdminModule,
    HealthModule,
    // ReconciliationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
