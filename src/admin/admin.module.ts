import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminAuthService } from './service.admin-auth';
import { AdminService } from './service.admin';
import { AdminResourceService } from './service.admin-resource';
import { AdminAuthController } from './controller.admin-auth';
import { AdminController } from './controller.admin';
import { AdminUsersController } from './controller.admin-users';
import { AdminKycController } from './controller.admin-kyc';
import { AdminWalletsController } from './controller.admin-wallets';
import { AdminVaultsController } from './controller.admin-vaults';
import { AdminDisbursementsController } from './controller.admin-disbursements';
import { AdminPaymentsController } from './controller.admin-payments';
import { AdminLedgerController } from './controller.admin-ledger';
import { AdminActivityController } from './controller.admin-activity';
import { AdminJwtStrategy } from './strategies/strategy.admin-jwt';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WalletModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminAuthController,
    AdminController,
    AdminUsersController,
    AdminKycController,
    AdminWalletsController,
    AdminVaultsController,
    AdminDisbursementsController,
    AdminPaymentsController,
    AdminLedgerController,
    AdminActivityController,
  ],
  providers: [AdminAuthService, AdminService, AdminResourceService, AdminJwtStrategy],
})
export class AdminModule {}
