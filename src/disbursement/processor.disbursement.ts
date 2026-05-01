import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DisbursementService } from './service.disbursement';

export const DRIP_QUEUE = 'drip';

@Processor(DRIP_QUEUE)
export class DisbursementProcessor extends WorkerHost {
  private readonly logger = new Logger(DisbursementProcessor.name);

  constructor(private readonly disbursements: DisbursementService) {
    super();
  }

  async process(job: Job<{ vaultId: string }>): Promise<void> {
    this.logger.log({ jobId: job.id, vaultId: job.data.vaultId }, 'Processing drip job');
    await this.disbursements.processDrip(job.data.vaultId);
  }
}
