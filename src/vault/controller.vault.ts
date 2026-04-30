import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { VaultService, VaultWithRelations } from './service.vault';
import { CreateVaultDto } from './lib/dto/dto.vault.create';

class VaultResponse {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ example: '500000' }) lockedAmountKobo: string;
  @ApiProperty({ example: '50000' }) trancheAmountKobo: string;
  @ApiProperty({ example: '400000' }) remainingKobo: string;
  @ApiProperty() totalTranches: number;
  @ApiProperty() tranchesSent: number;
  @ApiProperty({ example: 'WEEKLY' }) frequency: string;
  @ApiProperty({ example: 'ACTIVE' }) status: string;
  @ApiProperty() startsAt: Date;
  @ApiProperty() endsAt: Date;
  @ApiProperty({ nullable: true }) brokenAt: Date | null;
  @ApiProperty({ nullable: true, example: '50000' }) penaltyKobo: string | null;
  @ApiProperty() createdAt: Date;
}

@ApiTags('Vault')
@ApiBearerAuth()
@Controller('vault')
export class VaultController {
  constructor(private readonly vaults: VaultService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new savings vault' })
  @ApiResponse({ status: 201, type: VaultResponse })
  async create(@CurrentUser() user: User, @Body() dto: CreateVaultDto): Promise<VaultResponse> {
    return this.toResponse(await this.vaults.create(user.id, dto));
  }

  @Get('me')
  @ApiOperation({ summary: 'List my vaults' })
  @ApiResponse({ status: 200, type: [VaultResponse] })
  async listMine(@CurrentUser() user: User): Promise<VaultResponse[]> {
    return (await this.vaults.findByUser(user.id)).map((v) => this.toResponse(v));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vault by ID' })
  @ApiResponse({ status: 200, type: VaultResponse })
  async getOne(@CurrentUser() user: User, @Param('id') id: string): Promise<VaultResponse> {
    return this.toResponse(await this.vaults.findById(id, user.id));
  }

  @Post(':id/break')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Break vault early',
    description: 'Cancels the vault and returns remaining balance minus a 10% early-exit penalty.',
  })
  @ApiResponse({ status: 200, type: VaultResponse })
  async breakVault(@CurrentUser() user: User, @Param('id') id: string): Promise<VaultResponse> {
    return this.toResponse(await this.vaults.breakVault(user.id, id));
  }

  private toResponse(vault: VaultWithRelations): VaultResponse {
    const remaining =
      vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;

    return {
      id: vault.id,
      userId: vault.userId,
      name: vault.name,
      lockedAmountKobo: vault.lockedAmountKobo.toString(),
      trancheAmountKobo: vault.trancheAmountKobo.toString(),
      remainingKobo: remaining.toString(),
      totalTranches: vault.totalTranches,
      tranchesSent: vault.tranchesSent,
      frequency: vault.frequency.name,
      status: vault.status.name,
      startsAt: vault.startsAt,
      endsAt: vault.endsAt,
      brokenAt: vault.brokenAt,
      penaltyKobo: vault.penaltyKobo?.toString() ?? null,
      createdAt: vault.createdAt,
    };
  }
}
