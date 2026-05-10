import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaystackProvider } from '../payments/providers/paystack.provider';
import { ReconciliationService } from './service.reconciliation';

@Module({
  imports: [ConfigModule, PrismaModule, WalletModule],
  providers: [ReconciliationService, PaystackProvider],
})
export class ReconciliationModule {}
