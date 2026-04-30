import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

export class CreateVaultDto {
  @ApiPropertyOptional({ example: 'Holiday Savings' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Amount to lock, in Kobo (integer)',
    example: 500000,
  })
  @IsInt()
  @IsPositive()
  lockedAmountKobo: number;

  @ApiProperty({ description: 'Number of disbursement tranches', example: 10 })
  @IsInt()
  @Min(2)
  totalTranches: number;

  @ApiProperty({ enum: FREQUENCIES, example: 'WEEKLY' })
  @IsIn(FREQUENCIES)
  frequency: (typeof FREQUENCIES)[number];

  @ApiProperty({
    description: 'When the first drip should fire (ISO 8601)',
    example: '2026-05-01T08:00:00.000Z',
  })
  @IsDateString()
  startsAt: string;
}
