import { ApiProperty } from '@nestjs/swagger';

export class OtpSentResponse {
  @ApiProperty({ example: 'OTP sent successfully' })
  message: string;
}

export class OtpVerifiedResponse {
  @ApiProperty({ example: 'OTP verified successfully' })
  message: string;

  @ApiProperty({ description: 'Short-lived JWT — use only to call POST /auth/set-pin' })
  accessToken: string;
}

export class TokenPairResponse {
  @ApiProperty()
  message: string;

  @ApiProperty({ description: 'JWT access token (15 min)' })
  accessToken: string;

  @ApiProperty({ description: 'Opaque refresh token (30 days) — store securely' })
  refreshToken: string;
}

export class RefreshResponse {
  @ApiProperty({ description: 'New JWT access token (15 min)' })
  accessToken: string;

  @ApiProperty({ description: 'New refresh token — old token is immediately invalidated' })
  refreshToken: string;
}
