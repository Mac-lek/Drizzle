import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "08012345678",
    description: "Registered phone number or email address",
  })
  @IsString()
  identifier: string;

  @ApiProperty({ example: "MyP@ssw0rd!" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiPropertyOptional({ description: "Firebase Cloud Messaging token for this device" })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
