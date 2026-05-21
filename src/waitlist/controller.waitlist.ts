import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "@common/decorators/public.decorator";
import { SkipApiKey } from "@common/decorators/skip-api-key.decorator";
import { WaitlistService } from "./service.waitlist";
import { JoinWaitlistDto } from "./lib/dto/dto.waitlist.join";

class WaitlistApiResponse {
  @ApiProperty({ example: "You're on the waitlist! Check your email for confirmation." })
  message: string;
}

@ApiTags("Waitlist")
@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @Public()
  @SkipApiKey()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Join the waitlist" })
  @ApiResponse({ status: 201, type: WaitlistApiResponse })
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlist.join(dto);
  }
}
