import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

export class SubmitBvnDto {
  @ApiProperty({
    example: "12345678901",
    description: "11-digit Bank Verification Number",
  })
  @IsString()
  @Length(11, 11, { message: "BVN must be exactly 11 digits" })
  @Matches(/^\d+$/, { message: "BVN must contain only digits" })
  bvn: string;
}
