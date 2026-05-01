import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { DisbursementService } from './service.disbursement';
import { DisbursementProcessor } from './processor.disbursement';
import { DisbursementScheduler } from './scheduler.disbursement';
import { DRIP_QUEUE } from './processor.disbursement';

@Module({
  imports: [
    BullModule.registerQueue({ name: DRIP_QUEUE }),
    PrismaModule,
  ],
  providers: [DisbursementService, DisbursementProcessor, DisbursementScheduler],
  exports: [DisbursementService],
})
export class DisbursementModule {}
