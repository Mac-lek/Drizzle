import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class AdminVerifyOtpDto {
  @ApiProperty({ example: "admin@drizzle.app" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  otp: string;
}
