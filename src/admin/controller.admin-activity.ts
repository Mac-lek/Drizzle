import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';

@ApiTags('Admin — Activity Logs')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/activity-logs')
export class AdminActivityController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get()
  @RequirePermission('activity_logs', 'read')
  @ApiOperation({ summary: 'List all admin activity logs' })
  list() {
    return this.resource.listAllActivityLogs();
  }
}
