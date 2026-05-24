import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { UsersService } from "./service.users";
import { UpdateProfileDto } from "./lib/dto/dto.users.update-profile";
import { SubmitBvnDto } from "./lib/dto/dto.users.submit-bvn";
import { ok } from "@common/lib/utils/util.response";
import {
  PROFILE_FETCHED,
  PROFILE_UPDATED,
  SUCCESSFUL_VERIFICATION,
} from "@common/lib/enums/lib.enum.messages";

class ProfileData {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) phoneNumber: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiPropertyOptional({ nullable: true, example: "1995-04-12" }) dateOfBirth: Date | null;
  @ApiPropertyOptional({ nullable: true, enum: ["MALE", "FEMALE", "OTHER"] }) gender: string | null;
  @ApiProperty() bvnVerified: boolean;
  @ApiProperty() kycStatus: string;
  @ApiProperty() status: string;
  @ApiProperty({ description: "true when firstName, lastName, email, phoneNumber, dateOfBirth, gender and bvnVerified are all set" })
  profileComplete: boolean;
  @ApiProperty() createdAt: Date;
}

class ProfileApiResponse {
  @ApiProperty({ example: "Profile fetched successfully" }) message: string;
  @ApiProperty({ type: ProfileData }) data: ProfileData;
}

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get my profile" })
  @ApiResponse({ status: 200, type: ProfileApiResponse })
  async getMe(@CurrentUser() user: User) {
    return ok(PROFILE_FETCHED, await this.users.getProfile(user.id));
  }

  @Patch("me")
  @ApiOperation({ summary: "Update my profile" })
  @ApiResponse({ status: 200, type: ProfileApiResponse })
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    await this.users.updateProfile(user.id, dto);
    return ok(PROFILE_UPDATED, await this.users.getProfile(user.id));
  }

  @Post("me/bvn")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit and verify BVN",
    description:
      "Verifies the BVN against Dojah and stores it encrypted. " +
      "First and last name must be set. Can be retried if Dojah is temporarily unavailable.",
  })
  @ApiResponse({ status: 200, type: ProfileApiResponse })
  async submitBvn(@CurrentUser() user: User, @Body() dto: SubmitBvnDto) {
    await this.users.submitBvn(user.id, dto);
    return ok(SUCCESSFUL_VERIFICATION, await this.users.getProfile(user.id));
  }
}
