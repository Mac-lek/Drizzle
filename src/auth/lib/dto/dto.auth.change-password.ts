import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ example: "OldP@ssw0rd!" })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: "NewP@ssw0rd!", description: "Minimum 8 characters" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ example: "NewP@ssw0rd!" })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  confirmPassword: string;
}
