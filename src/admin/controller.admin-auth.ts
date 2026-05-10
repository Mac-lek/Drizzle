import { Body, Controller, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './service.admin-auth';
import { AdminLoginDto } from './lib/dto/dto.admin-auth.login';
import { AdminVerifyOtpDto } from './lib/dto/dto.admin-auth.verify-otp';
import { AcceptInviteDto } from './lib/dto/dto.admin-auth.accept-invite';
import { AdminRefreshDto } from './lib/dto/dto.admin-auth.refresh';

class OtpSentResponse { @ApiProperty() message: string; }
class TokenPairResponse { @ApiProperty() accessToken: string; @ApiProperty() refreshToken: string; }

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — sends OTP to email' })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  login(@Body() dto: AdminLoginDto, @Ip() ip: string): Promise<OtpSentResponse> {
    return this.auth.login(dto, ip);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP — returns JWT pair' })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  verifyOtp(@Body() dto: AdminVerifyOtpDto, @Ip() ip: string): Promise<TokenPairResponse> {
    return this.auth.verifyOtp(dto, ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  refresh(@Body() dto: AdminRefreshDto): Promise<TokenPairResponse> {
    return this.auth.refresh(dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invite and set password' })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  acceptInvite(@Body() dto: AcceptInviteDto): Promise<OtpSentResponse> {
    return this.auth.acceptInvite(dto);
  }
}
