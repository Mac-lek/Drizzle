import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @Matches(/^(\+?234|0)[789]\d{9}$/, { message: 'Invalid Nigerian phone number' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}
