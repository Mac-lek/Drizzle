import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { KycService } from './service.kyc';
import { SubmitBvnDto } from './lib/dto/dto.kyc.tier1';

class KycStatusResponse {
  @ApiProperty({ example: 'TIER_1_VERIFIED' }) kycStatus: string;
  @ApiProperty() bvnVerified: boolean;
}

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get my KYC status' })
  @ApiResponse({ status: 200, type: KycStatusResponse })
  getStatus(@CurrentUser() user: User): Promise<KycStatusResponse> {
    return this.kyc.getStatus(user.id);
  }

  @Post('tier-1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit BVN for Tier 1 verification',
    description:
      'Verifies the BVN against Dojah. Profile (first name + last name) must be complete first. ' +
      'Can be retried if a previous attempt failed.',
  })
  @ApiResponse({ status: 200, type: KycStatusResponse })
  async submitTier1(
    @CurrentUser() user: User,
    @Body() dto: SubmitBvnDto,
  ): Promise<KycStatusResponse> {
    await this.kyc.submitTier1(user.id, dto);
    return this.kyc.getStatus(user.id);
  }
}
