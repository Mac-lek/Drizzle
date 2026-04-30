import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletService } from './service.wallet';
import { WalletController } from './controller.wallet';

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
