import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';
import { AdminUserActionDto } from './lib/dto/dto.admin-resource';

@ApiTags('Admin — Users')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'List all users' })
  list() {
    return this.resource.listUsers();
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get user by ID' })
  getOne(@Param('id') id: string) {
    return this.resource.getUser(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users', 'suspend')
  @ApiOperation({ summary: 'Suspend or blacklist a user' })
  updateStatus(@Param('id') id: string, @Body() dto: AdminUserActionDto) {
    return this.resource.updateUserStatus(id, dto);
  }
}
