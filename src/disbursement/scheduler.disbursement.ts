import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DisbursementService } from './service.disbursement';
import { DRIP_QUEUE } from './processor.disbursement';

@Injectable()
export class DisbursementScheduler {
  private readonly logger = new Logger(DisbursementScheduler.name);

  constructor(
    @InjectQueue(DRIP_QUEUE) private readonly queue: Queue,
    private readonly disbursements: DisbursementService,
  ) {}

  @Cron('* * * * *')
  async enqueueDueVaults(): Promise<void> {
    const vaults = await this.disbursements.findDueVaults();

    if (vaults.length === 0) return;

    this.logger.log(`Enqueueing ${vaults.length} due vault drip(s)`);

    for (const vault of vaults) {
      const dripNumber = vault.tranchesSent + 1;
      await this.queue.add(
        'process-drip',
        { vaultId: vault.id },
        {
          // Stable job ID prevents duplicates if the cron fires before the job completes
          jobId: `drip-${vault.id}-${dripNumber}`,
          removeOnComplete: true,
          removeOnFail: { count: 100 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }
  }
}
