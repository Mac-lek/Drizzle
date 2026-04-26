import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, ValidateIf } from 'class-validator';

export class SignupDto {
  @ApiPropertyOptional({ example: '08012345678', description: 'Nigerian phone number' })
  @ValidateIf((o) => !!o.phone || !o.email)
  @IsString()
  @Matches(/^(\+?234|0)[789]\d{9}$/, { message: 'Invalid Nigerian phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf((o) => !!o.email || !o.phone)
  @IsEmail()
  email?: string;
}
