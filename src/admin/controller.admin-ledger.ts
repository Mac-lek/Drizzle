import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';

@ApiTags('Admin — Ledger')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/ledger')
export class AdminLedgerController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get(':accountId')
  @RequirePermission('ledger', 'read')
  @ApiOperation({ summary: 'Get ledger entries for an account (wallet or vault ID)' })
  getEntries(@Param('accountId') accountId: string) {
    return this.resource.getLedgerEntries(accountId);
  }
}
