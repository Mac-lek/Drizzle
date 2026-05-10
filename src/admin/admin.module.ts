import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAuthService } from './service.admin-auth';
import { AdminService } from './service.admin';
import { AdminAuthController } from './controller.admin-auth';
import { AdminController } from './controller.admin';
import { AdminJwtStrategy } from './strategies/strategy.admin-jwt';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService, AdminJwtStrategy],
})
export class AdminModule {}
