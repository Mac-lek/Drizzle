import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './service.admin';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { CurrentAdmin } from './decorators/decorator.current-admin';
import { RequirePermission } from './decorators/decorator.require-permission';
import { InviteAdminDto } from './lib/dto/dto.admin.invite';
import { UpdateAdminPermissionsDto } from './lib/dto/dto.admin.update-permissions';
import { UpdateAdminStatusDto } from './lib/dto/dto.admin.update-status';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admins: AdminService) {}

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admins', 'invite')
  @ApiOperation({ summary: 'Invite a new admin (Super Admin only)' })
  invite(@CurrentAdmin() actor: any, @Body() dto: InviteAdminDto) {
    return this.admins.invite(actor.id, dto);
  }

  @Get()
  @RequirePermission('admins', 'read')
  @ApiOperation({ summary: 'List all admins' })
  list() {
    return this.admins.list();
  }

  @Get(':id')
  @RequirePermission('admins', 'read')
  @ApiOperation({ summary: 'Get admin by ID' })
  getOne(@Param('id') id: string) {
    return this.admins.getOne(id);
  }

  @Patch(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admins', 'invite')
  @ApiOperation({ summary: 'Update per-admin permission overrides' })
  updatePermissions(
    @CurrentAdmin() actor: any,
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
  ) {
    return this.admins.updatePermissions(actor.id, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admins', 'invite')
  @ApiOperation({ summary: 'Activate, suspend, or deactivate an admin' })
  updateStatus(
    @CurrentAdmin() actor: any,
    @Param('id') id: string,
    @Body() dto: UpdateAdminStatusDto,
  ) {
    return this.admins.updateStatus(actor.id, id, dto);
  }

  @Get(':id/activity')
  @RequirePermission('activity_logs', 'read')
  @ApiOperation({ summary: 'Get activity logs for an admin' })
  getActivityLogs(@Param('id') id: string) {
    return this.admins.getActivityLogs(id);
  }
}
