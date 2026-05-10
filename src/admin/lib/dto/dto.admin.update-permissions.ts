import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNumber, IsString, ValidateNested } from "class-validator";

class PermissionEntryDto {
  @IsNumber()
  resourceId: number;

  @IsString()
  permissions: string;
}

export class UpdateAdminPermissionsDto {
  @ApiProperty({ example: [{ resourceId: 1, permissions: "read,override" }] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions: PermissionEntryDto[];
}
