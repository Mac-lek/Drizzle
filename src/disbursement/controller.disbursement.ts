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
import { ok } from "@common/lib/utils/util.response";
import {
  DISBURSEMENTS_FETCHED,
  DISBURSEMENT_FETCHED,
} from "@common/lib/enums/lib.enum.messages";

class DisbursementData {
  @ApiProperty() id: string;
  @ApiProperty() vaultId: string;
  @ApiProperty({ nullable: true }) vaultName: string | null;
  @ApiProperty() dripNumber: number;
  @ApiProperty({ description: "Amount in Kobo", example: "50000" }) amountKobo: string;
  @ApiProperty({ example: "COMPLETED" }) status: string;
  @ApiProperty({ nullable: true }) failReason: string | null;
  @ApiProperty({ nullable: true }) attemptedAt: Date | null;
  @ApiProperty({ nullable: true }) completedAt: Date | null;
  @ApiProperty() createdAt: Date;
}

class DisbursementApiResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: DisbursementData }) data: DisbursementData;
}

class DisbursementListApiResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: [DisbursementData] }) data: DisbursementData[];
}

@ApiTags("Disbursement")
@ApiBearerAuth()
@Controller("disbursement")
export class DisbursementController {
  constructor(private readonly disbursements: DisbursementService) {}

  @Get("me")
  @ApiOperation({ summary: "List my disbursements" })
  @ApiResponse({ status: 200, type: DisbursementListApiResponse })
  async listMine(@CurrentUser() user: User) {
    return ok(DISBURSEMENTS_FETCHED, (await this.disbursements.findByUser(user.id)).map(this.toResponse));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get disbursement by ID" })
  @ApiResponse({ status: 200, type: DisbursementApiResponse })
  async getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return ok(DISBURSEMENT_FETCHED, this.toResponse(await this.disbursements.findById(id, user.id)));
  }

  private toResponse(d: {
    id: string;
    vaultId: string;
    vaultName: string | null;
    dripNumber: number;
    amountKobo: bigint;
    status: { name: string };
    failReason: string | null;
    attemptedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): DisbursementData {
    return {
      id: d.id,
      vaultId: d.vaultId,
      vaultName: d.vaultName,
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
