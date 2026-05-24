import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class VerifyDeviceDto {
  @ApiProperty({
    example: "08012345678",
    description: "Phone number or email used at login",
  })
  @IsString()
  identifier: string;

  @ApiProperty({ example: "123456", description: "6-digit OTP from SMS or email" })
  @IsString()
  @Matches(/^\d{6}$/, { message: "OTP must be exactly 6 digits" })
  otp: string;

  @ApiProperty({ description: "Firebase Cloud Messaging token for this device" })
  @IsString()
  fcmToken: string;
}
