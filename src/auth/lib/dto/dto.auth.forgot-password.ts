import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "08012345678 or user@example.com",
    description: "Phone number or email address associated with the account",
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
