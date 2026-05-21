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
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { Public } from "@common/decorators/public.decorator";
import { KycService, SmileWebhookBody } from "./service.kyc";

class KycStatusResponse {
  @ApiProperty({ example: "NONE" }) kycStatus: string;
}

class KycInitiateResponse {
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
  getStatus(@CurrentUser() user: User) {
    return this.kyc.getStatus(user.id);
  }

  @Post("initiate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate biometric KYC verification",
    description:
      "Creates a Smile Identity hosted verification session. Returns a URL for the user to complete " +
      "selfie + document verification. BVN must be verified first.",
  })
  @ApiResponse({ status: 200, type: KycInitiateResponse })
  initiate(@CurrentUser() user: User) {
    return this.kyc.initiate(user.id);
  }

  @Public()
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiSecurity("x-api-key")
  @ApiOperation({ summary: "Smile Identity webhook receiver (internal)" })
  async smileWebhook(
    @Body() body: SmileWebhookBody,
  ): Promise<{ received: boolean }> {
    await this.kyc.handleSmileCallback(body);
    return { received: true };
  }
}
