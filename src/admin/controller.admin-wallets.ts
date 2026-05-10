import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { CurrentAdmin } from './decorators/decorator.current-admin';
import { AdminResourceService } from './service.admin-resource';
import { AdminWalletCreditDebitDto } from './lib/dto/dto.admin-resource';

@ApiTags('Admin — Wallets')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/wallets')
export class AdminWalletsController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get(':userId')
  @RequirePermission('wallets', 'read')
  @ApiOperation({ summary: 'Get wallet and balance for a user' })
  getOne(@Param('userId') userId: string) {
    return this.resource.getWallet(userId);
  }

  @Post(':userId/credit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('wallets', 'credit')
  @ApiOperation({ summary: 'Credit a user wallet' })
  credit(
    @Param('userId') userId: string,
    @Body() dto: AdminWalletCreditDebitDto,
    @CurrentAdmin() actor: any,
  ) {
    return this.resource.creditWallet(userId, dto, actor.id);
  }

  @Post(':userId/debit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('wallets', 'debit')
  @ApiOperation({ summary: 'Debit a user wallet' })
  debit(
    @Param('userId') userId: string,
    @Body() dto: AdminWalletCreditDebitDto,
    @CurrentAdmin() actor: any,
  ) {
    return this.resource.debitWallet(userId, dto, actor.id);
  }
}
