import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class SetTransactionPinDto {
  @ApiProperty({ example: "1234", description: "4-digit numeric transaction PIN" })
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin: string;
}
