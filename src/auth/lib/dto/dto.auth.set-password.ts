import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength, Matches } from "class-validator";

export class SetPasswordDto {
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
