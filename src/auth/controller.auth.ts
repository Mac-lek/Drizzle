import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './service.auth';
import { SignupDto } from './lib/dto/dto.auth.signup';
import { VerifyOtpDto } from './lib/dto/dto.auth.verify-otp';
import { SetPinDto } from './lib/dto/dto.auth.set-pin';
import { LoginDto } from './lib/dto/dto.auth.login';
import { RefreshDto } from './lib/dto/dto.auth.refresh';
import {
  OtpSentResponse,
  OtpVerifiedResponse,
  TokenPairResponse,
  RefreshResponse,
} from './lib/schemas/schema.auth.responses';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start registration',
    description:
      'Provide a Nigerian phone number (and optional email). An OTP is sent via SMS. ' +
      'Returns the same success response whether or not the phone is already registered.',
  })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  @ApiBadRequestResponse({ description: 'Validation error — invalid phone format' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify SMS OTP',
    description:
      'Submit the 6-digit OTP received on the registered phone number. ' +
      'Returns a short-lived access token valid only for POST /auth/set-pin.',
  })
  @ApiResponse({ status: 200, type: OtpVerifiedResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('set-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set account PIN',
    description:
      'Called immediately after verify-otp using the returned access token. ' +
      'Sets a 4-digit numeric PIN and returns a full access + refresh token pair.',
  })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  setPin(@CurrentUser() user: User, @Body() dto: SetPinDto) {
    return this.auth.setPin(user.id, dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with PIN',
    description:
      'Accepts a phone number or email address as the identifier, plus the 4-digit PIN. ' +
      'Returns a new access + refresh token pair on success.',
  })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Exchange a valid refresh token for a new access + refresh token pair. ' +
      'The submitted refresh token is immediately invalidated (rotation).',
  })
  @ApiResponse({ status: 200, type: RefreshResponse })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid, expired, or already used' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description:
      'Invalidates any pending OTPs and sends a fresh one to the registered phone. ' +
      'Returns the same success response regardless of registration status.',
  })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  @ApiBadRequestResponse({ description: 'Validation error' })
  resendOtp(@Body() dto: SignupDto) {
    return this.auth.resendOtp(dto);
  }
}
