import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: "+2348012345678",
    description: "Nigerian phone number in E.164 format",
  })
  @IsOptional()
  @IsPhoneNumber("NG")
  phone?: string;

  @ApiPropertyOptional({
    example: "1995-04-12",
    description: "Date of birth in ISO 8601 format (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: ["MALE", "FEMALE", "OTHER"],
    example: "MALE",
  })
  @IsOptional()
  @IsIn(["MALE", "FEMALE", "OTHER"])
  gender?: string;
}
