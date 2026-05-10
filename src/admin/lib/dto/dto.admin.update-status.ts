import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateAdminStatusDto {
  @ApiProperty({ example: 'SUSPENDED', description: 'ACTIVE | INACTIVE | SUSPENDED | DEACTIVATED' })
  @IsString()
  status: string;
}
