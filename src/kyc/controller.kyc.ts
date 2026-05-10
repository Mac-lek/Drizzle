import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { Public } from "@common/decorators/public.decorator";
import { KycService, SmileWebhookBody } from "./service.kyc";
import { SubmitBvnDto } from "./lib/dto/dto.kyc.tier1";

class KycStatusResponse {
  @ApiProperty({ example: "TIER_1_VERIFIED" }) kycStatus: string;
  @ApiProperty() bvnVerified: boolean;
}

class Tier2InitResponse {
  @ApiProperty({ example: "https://links.usesmileid.com/..." }) url: string;
}

@ApiTags("KYC")
@ApiBearerAuth()
@Controller("kyc")
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get("status")
  @ApiOperation({ summary: "Get my KYC status" })
  @ApiResponse({ status: 200, type: KycStatusResponse })
  getStatus(@CurrentUser() user: User): Promise<KycStatusResponse> {
    return this.kyc.getStatus(user.id);
  }

  @Post("tier-1")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit BVN for Tier 1 verification",
    description:
      "Verifies the BVN against Dojah. Profile (first name + last name) must be complete first. " +
      "Can be retried if a previous attempt failed.",
  })
  @ApiResponse({ status: 200, type: KycStatusResponse })
  async submitTier1(
    @CurrentUser() user: User,
    @Body() dto: SubmitBvnDto,
  ): Promise<KycStatusResponse> {
    await this.kyc.submitTier1(user.id, dto);
    return this.kyc.getStatus(user.id);
  }

  @Post("tier-2")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate Tier 2 verification",
    description:
      "Creates a Smile Identity hosted verification session. Returns a URL for the user to complete " +
      "selfie + document verification. Tier 1 must be completed first.",
  })
  @ApiResponse({ status: 200, type: Tier2InitResponse })
  initiateTier2(@CurrentUser() user: User): Promise<Tier2InitResponse> {
    return this.kyc.initiateTier2(user.id);
  }

  @Public()
  @Post("tier-2/webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Smile Identity webhook receiver (internal)" })
  async smileWebhook(
    @Body() body: SmileWebhookBody,
  ): Promise<{ received: boolean }> {
    await this.kyc.handleSmileCallback(body);
    return { received: true };
  }
}
