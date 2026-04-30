import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class FundDto {
  @ApiProperty({
    description: 'Amount to credit in Kobo (minimum 10000 = ₦100)',
    example: 500000,
  })
  @IsInt()
  @IsPositive()
  amountKobo: number;
}
