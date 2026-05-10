import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { DisbursementService } from "./service.disbursement";

class DisbursementResponse {
  @ApiProperty() id: string;
  @ApiProperty() vaultId: string;
  @ApiProperty() dripNumber: number;
  @ApiProperty({ description: "Amount in Kobo", example: "50000" })
  amountKobo: string;
  @ApiProperty({ example: "COMPLETED" }) status: string;
  @ApiProperty({ nullable: true }) failReason: string | null;
  @ApiProperty({ nullable: true }) attemptedAt: Date | null;
  @ApiProperty({ nullable: true }) completedAt: Date | null;
  @ApiProperty() createdAt: Date;
}

@ApiTags("Disbursement")
@ApiBearerAuth()
@Controller("disbursement")
export class DisbursementController {
  constructor(private readonly disbursements: DisbursementService) {}

  @Get("me")
  @ApiOperation({ summary: "List my disbursements" })
  @ApiResponse({ status: 200, type: [DisbursementResponse] })
  async listMine(@CurrentUser() user: User): Promise<DisbursementResponse[]> {
    return (await this.disbursements.findByUser(user.id)).map(this.toResponse);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get disbursement by ID" })
  @ApiResponse({ status: 200, type: DisbursementResponse })
  async getOne(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ): Promise<DisbursementResponse> {
    return this.toResponse(await this.disbursements.findById(id, user.id));
  }

  private toResponse(d: {
    id: string;
    vaultId: string;
    dripNumber: number;
    amountKobo: bigint;
    status: { name: string };
    failReason: string | null;
    attemptedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): DisbursementResponse {
    return {
      id: d.id,
      vaultId: d.vaultId,
      dripNumber: d.dripNumber,
      amountKobo: d.amountKobo.toString(),
      status: d.status.name,
      failReason: d.failReason,
      attemptedAt: d.attemptedAt,
      completedAt: d.completedAt,
      createdAt: d.createdAt,
    };
  }
}
