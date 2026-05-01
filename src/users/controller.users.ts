import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UsersService } from './service.users';
import { UpdateProfileDto } from './lib/dto/dto.users.update-profile';

class ProfileResponse {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) phoneNumber: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiProperty() bvnVerified: boolean;
  @ApiProperty() kycStatus: string;
  @ApiProperty() status: string;
  @ApiProperty({ description: 'true when firstName, lastName and email are all set' })
  profileComplete: boolean;
  @ApiProperty() createdAt: Date;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponse({ status: 200, type: ProfileResponse })
  async getMe(@CurrentUser() user: User): Promise<ProfileResponse> {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiResponse({ status: 200, type: ProfileResponse })
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    await this.users.updateProfile(user.id, dto);
    return this.users.getProfile(user.id);
  }
}
