import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';

@ApiTags('Admin — Disbursements')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/disbursements')
export class AdminDisbursementsController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get()
  @RequirePermission('disbursements', 'read')
  @ApiOperation({ summary: 'List disbursements (optionally filtered by vaultId)' })
  @ApiQuery({ name: 'vaultId', required: false })
  list(@Query('vaultId') vaultId?: string) {
    return this.resource.listDisbursements(vaultId);
  }

  @Get(':id')
  @RequirePermission('disbursements', 'read')
  @ApiOperation({ summary: 'Get disbursement detail' })
  getOne(@Param('id') id: string) {
    return this.resource.getDisbursement(id);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('disbursements', 'retry')
  @ApiOperation({ summary: 'Retry a FAILED disbursement' })
  retry(@Param('id') id: string) {
    return this.resource.retryDisbursement(id);
  }
}
