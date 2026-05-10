import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class InviteAdminDto {
  @ApiProperty({ example: "compliance@drizzle.app" })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "COMPLIANCE",
    description: "Admin role code: SADM | COMPLIANCE | SUPPORT | FINANCE | OPS",
  })
  @IsString()
  roleCode: string;
}
