import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';

@ApiTags('Admin — Payments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get()
  @RequirePermission('payments', 'read')
  @ApiOperation({ summary: 'List all payment webhook events' })
  list() {
    return this.resource.listPayments();
  }

  @Get(':id')
  @RequirePermission('payments', 'read')
  @ApiOperation({ summary: 'Get payment event detail' })
  getOne(@Param('id') id: string) {
    return this.resource.getPayment(id);
  }
}
