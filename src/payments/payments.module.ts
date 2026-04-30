import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackProvider } from './providers/paystack.provider';
import { PaymentsService } from './service.payments';
import { PaymentsController } from './controller.payments';

@Module({
  imports: [ConfigModule, PrismaModule, UsersModule, WalletModule],
  providers: [PaystackProvider, PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
