import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class AdminUserActionDto {
  @ApiProperty({ example: 'SUSPENDED', enum: ['SUSPENDED', 'BLACKLISTED', 'ACTIVE'] })
  @IsIn(['SUSPENDED', 'BLACKLISTED', 'ACTIVE'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminKycOverrideDto {
  @ApiProperty({ example: 'VERIFIED', enum: ['VERIFIED', 'FAILED'] })
  @IsIn(['VERIFIED', 'FAILED'])
  kycStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminWalletCreditDebitDto {
  @ApiProperty({ example: 50000, description: 'Amount in kobo' })
  @IsNumber()
  @IsPositive()
  amountKobo: number;

  @ApiProperty({ example: 'Manual credit by finance team' })
  @IsString()
  description: string;
}
