import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from './guards/guard.admin-jwt';
import { AdminPermissionGuard } from './guards/guard.admin-permission';
import { RequirePermission } from './decorators/decorator.require-permission';
import { AdminResourceService } from './service.admin-resource';
import { AdminKycOverrideDto } from './lib/dto/dto.admin-resource';

@ApiTags('Admin — KYC')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminPermissionGuard)
@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly resource: AdminResourceService) {}

  @Get('pending')
  @RequirePermission('kyc', 'read')
  @ApiOperation({ summary: 'List users with pending KYC' })
  listPending() {
    return this.resource.listKycPending();
  }

  @Get(':userId')
  @RequirePermission('kyc', 'read')
  @ApiOperation({ summary: 'Get KYC status for a user' })
  getOne(@Param('userId') userId: string) {
    return this.resource.getUserKyc(userId);
  }

  @Post(':userId/override')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('kyc', 'override')
  @ApiOperation({ summary: 'Manually override a user KYC status' })
  override(@Param('userId') userId: string, @Body() dto: AdminKycOverrideDto) {
    return this.resource.overrideKyc(userId, dto);
  }
}
