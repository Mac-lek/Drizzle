import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { VaultService } from './service.vault';
import { VaultController } from './controller.vault';

@Module({
  imports: [PrismaModule, WalletModule],
  providers: [VaultService],
  controllers: [VaultController],
  exports: [VaultService],
})
export class VaultModule {}
