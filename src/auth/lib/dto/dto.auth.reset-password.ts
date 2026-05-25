import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({
    example: "08012345678 or user@example.com",
    description: "Phone number or email used to request the reset",
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: "OTP must be 6 digits" })
  otp: string;

  @ApiProperty({ example: "MyP@ssw0rd!", description: "Minimum 8 characters" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ example: "MyP@ssw0rd!" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  confirmPassword: string;
}
