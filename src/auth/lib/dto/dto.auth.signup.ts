import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: '08012345678', description: 'Nigerian phone number' })
  @IsString()
  @Matches(/^(\+?234|0)[789]\d{9}$/, { message: 'Invalid Nigerian phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
