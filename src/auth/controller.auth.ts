import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";
import { AuthService } from "./service.auth";
import { SignupDto } from "./lib/dto/dto.auth.signup";
import { VerifyOtpDto } from "./lib/dto/dto.auth.verify-otp";
import { SetPasswordDto } from "./lib/dto/dto.auth.set-password";
import { SetTransactionPinDto } from "./lib/dto/dto.auth.set-transaction-pin";
import { VerifyDeviceDto } from "./lib/dto/dto.auth.verify-device";
import { LoginDto } from "./lib/dto/dto.auth.login";
import { RefreshDto } from "./lib/dto/dto.auth.refresh";
import { ForgotPasswordDto } from "./lib/dto/dto.auth.forgot-password";
import { ResetPasswordDto } from "./lib/dto/dto.auth.reset-password";
import { ChangePasswordDto } from "./lib/dto/dto.auth.change-password";
import {
  OtpSentResponse,
  OtpVerifiedResponse,
  TokenPairResponse,
  RefreshResponse,
  DeviceVerificationRequiredResponse,
} from "./lib/schemas/schema.auth.responses";
import { Public } from "@common/decorators/public.decorator";
import { AllowOnboarding } from "@common/decorators/allow-onboarding.decorator";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { User } from "@prisma/client";

@ApiTags("Auth")
@ApiSecurity("x-api-key")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("signup")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start registration",
    description:
      "Provide a Nigerian phone number or email address. An OTP is sent via SMS or email. " +
      "Returns the same success response whether or not the identifier is already registered.",
  })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  @ApiBadRequestResponse({ description: "Validation error — invalid phone or email format" })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify OTP",
    description:
      "Submit the 6-digit OTP received via SMS or email. " +
      "Returns a short-lived onboarding token valid only for POST /auth/set-password.",
  })
  @ApiResponse({ status: 200, type: OtpVerifiedResponse })
  @ApiUnauthorizedResponse({ description: "Invalid or expired OTP" })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post("set-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @AllowOnboarding()
  @ApiOperation({
    summary: "Set account password",
    description:
      "Called immediately after verify-otp using the returned onboarding token. " +
      "Sets the account password and returns a full access + refresh token pair.",
  })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  @ApiBadRequestResponse({ description: "Passwords do not match" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  setPassword(@CurrentUser() user: User, @Body() dto: SetPasswordDto) {
    return this.auth.setPassword(user.id, dto);
  }

  @Post("set-transaction-pin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @AllowOnboarding()
  @ApiOperation({
    summary: "Set transaction PIN",
    description:
      "Sets a 4-digit numeric PIN used to authorise transactions. " +
      "Accepts both onboarding and regular access tokens — can be called during " +
      "onboarding or any time after login.",
  })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  setTransactionPin(@CurrentUser() user: User, @Body() dto: SetTransactionPinDto) {
    return this.auth.setTransactionPin(user.id, dto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Login with password",
    description:
      "Accepts a phone number or email address plus the account password. " +
      "Known devices receive a token pair immediately. " +
      "Unknown or absent FCM tokens trigger device verification — the response includes " +
      "`requiresDeviceVerification: true` and an OTP is sent via SMS or email.",
  })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  @ApiResponse({ status: 200, type: DeviceVerificationRequiredResponse })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("verify-device")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify new device",
    description:
      "Submit the 6-digit OTP sent during login for an unrecognised device. " +
      "Marks the device as trusted and returns a full access + refresh token pair.",
  })
  @ApiResponse({ status: 200, type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: "Invalid or expired OTP" })
  verifyDevice(@Body() dto: VerifyDeviceDto) {
    return this.auth.verifyDevice(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rotate refresh token",
    description:
      "Exchange a valid refresh token for a new access + refresh token pair. " +
      "The submitted refresh token is immediately invalidated (rotation).",
  })
  @ApiResponse({ status: 200, type: RefreshResponse })
  @ApiUnauthorizedResponse({ description: "Refresh token invalid, expired, or already used" })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @Post("resend-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Resend OTP",
    description:
      "Invalidates any pending OTPs and sends a fresh one. " +
      "Returns the same success response regardless of registration status.",
  })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  @ApiBadRequestResponse({ description: "Validation error" })
  resendOtp(@Body() dto: SignupDto) {
    return this.auth.resendOtp(dto);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request password reset OTP",
    description:
      "Sends a 6-digit OTP to the phone number or email associated with the account. " +
      "Always returns the same success response to prevent account enumeration.",
  })
  @ApiResponse({ status: 200, type: OtpSentResponse })
  @ApiBadRequestResponse({ description: "Validation error" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset password with OTP",
    description:
      "Verifies the OTP from forgot-password and sets the new password. " +
      "The user must log in again after resetting.",
  })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse({ description: "Invalid or expired OTP" })
  @ApiBadRequestResponse({ description: "Passwords do not match" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Change password (settings)",
    description:
      "Authenticated route. Validates the current password before applying the new one.",
  })
  @ApiResponse({ status: 200 })
  @ApiUnauthorizedResponse({ description: "Current password is incorrect" })
  @ApiBadRequestResponse({ description: "Passwords do not match or no password set" })
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }
}
