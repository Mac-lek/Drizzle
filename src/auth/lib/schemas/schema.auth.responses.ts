import { ApiProperty } from "@nestjs/swagger";

class OtpData {
  @ApiProperty({ description: "OTP code (only present in dev/staging)", required: false })
  otp?: string;
}

export class OtpSentResponse {
  @ApiProperty({ example: "OTP sent successfully" }) message: string;
  @ApiProperty({ type: OtpData, required: false }) data?: OtpData;
}

class AccessTokenData {
  @ApiProperty({ description: "Short-lived JWT — use only to call POST /auth/set-password" })
  accessToken: string;
}

export class OtpVerifiedResponse {
  @ApiProperty({ example: "OTP verified successfully" }) message: string;
  @ApiProperty({ type: AccessTokenData }) data: AccessTokenData;
}

class DeviceVerificationRequiredData {
  @ApiProperty({ example: true }) requiresDeviceVerification: boolean;
}

export class DeviceVerificationRequiredResponse {
  @ApiProperty({ example: "New device detected, verify your account with the OTP sent to your phone" })
  message: string;
  @ApiProperty({ type: DeviceVerificationRequiredData }) data: DeviceVerificationRequiredData;
}

class TokenPairData {
  @ApiProperty({ description: "JWT access token (15 min)" }) accessToken: string;
  @ApiProperty({ description: "Opaque refresh token (30 days) — store securely" }) refreshToken: string;
}

export class TokenPairResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: TokenPairData }) data: TokenPairData;
}

export class RefreshResponse {
  @ApiProperty({ example: "Token refreshed successfully" }) message: string;
  @ApiProperty({ type: TokenPairData }) data: TokenPairData;
}
