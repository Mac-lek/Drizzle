import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AdminAuthService } from "./service.admin-auth";
import { AdminLoginDto } from "./lib/dto/dto.admin-auth.login";
import { AdminVerifyOtpDto } from "./lib/dto/dto.admin-auth.verify-otp";
import { AcceptInviteDto } from "./lib/dto/dto.admin-auth.accept-invite";
import { AdminRefreshDto } from "./lib/dto/dto.admin-auth.refresh";

@ApiTags("Admin Auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Admin login — sends OTP to email" })
  @ApiResponse({ status: 200 })
  login(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify OTP — returns JWT pair" })
  @ApiResponse({ status: 200 })
  verifyOtp(@Body() dto: AdminVerifyOtpDto, @Ip() ip: string) {
    return this.auth.verifyOtp(dto, ip);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate refresh token" })
  @ApiResponse({ status: 200 })
  refresh(@Body() dto: AdminRefreshDto) {
    return this.auth.refresh(dto);
  }

  @Post("accept-invite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept invite and set password" })
  @ApiResponse({ status: 200 })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto);
  }
}
