import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';

@ApiTags('Admin — Vaults')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/vaults')
export class AdminVaultsController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get()
  @RequirePermission('vaults', 'read')
  @ApiOperation({ summary: 'List all vaults (optionally filtered by userId)' })
  @ApiQuery({ name: 'userId', required: false })
  list(@Query('userId') userId?: string) {
    return this.resource.listVaults(userId);
  }

  @Get(':id')
  @RequirePermission('vaults', 'read')
  @ApiOperation({ summary: 'Get vault detail with disbursement history' })
  getOne(@Param('id') id: string) {
    return this.resource.getVault(id);
  }

  @Post(':id/force-break')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vaults', 'force-break')
  @ApiOperation({ summary: 'Force-break a vault with no penalty (full balance returned)' })
  forceBreak(@Param('id') id: string) {
    return this.resource.forceBreakVault(id);
  }
}
