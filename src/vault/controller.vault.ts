import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { VaultService, VaultListItem, VaultDetail } from "./service.vault";
import { CreateVaultDto } from "./lib/dto/dto.vault.create";
import { ok } from "@common/lib/utils/util.response";
import {
  VAULT_CREATED,
  VAULT_FETCHED,
  VAULTS_FETCHED,
  VAULT_BROKEN,
} from "@common/lib/enums/lib.enum.messages";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function computeScheduledAt(startsAt: Date, dripNumber: number, frequency: string): Date {
  const d = new Date(startsAt);
  const n = dripNumber - 1;
  switch (frequency) {
    case "DAILY": d.setDate(d.getDate() + n); break;
    case "WEEKLY": d.setDate(d.getDate() + n * 7); break;
    case "BIWEEKLY": d.setDate(d.getDate() + n * 14); break;
    case "MONTHLY": d.setMonth(d.getMonth() + n); break;
  }
  return d;
}

class DripEntryData {
  @ApiProperty({ nullable: true }) id: string | null;
  @ApiProperty() dripNumber: number;
  @ApiProperty({ example: "50000" }) amountKobo: string;
  @ApiProperty() scheduledAt: Date;
  @ApiProperty({ example: "COMPLETED" }) status: string;
  @ApiProperty({ nullable: true }) failReason: string | null;
  @ApiProperty({ nullable: true }) attemptedAt: Date | null;
  @ApiProperty({ nullable: true }) completedAt: Date | null;
  @ApiProperty({ nullable: true }) createdAt: Date | null;
}

class VaultData {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ example: "500000" }) lockedAmountKobo: string;
  @ApiProperty({ example: "50000" }) trancheAmountKobo: string;
  @ApiProperty({ example: "400000" }) remainingKobo: string;
  @ApiProperty() totalTranches: number;
  @ApiProperty() tranchesSent: number;
  @ApiProperty({ example: "WEEKLY" }) frequency: string;
  @ApiProperty({ example: "ACTIVE" }) status: string;
  @ApiProperty() startsAt: Date;
  @ApiProperty() endsAt: Date;
  @ApiProperty({ nullable: true }) brokenAt: Date | null;
  @ApiProperty({ nullable: true, example: "50000" }) penaltyKobo: string | null;
  @ApiProperty() createdAt: Date;
}

class VaultDetailData extends VaultData {
  @ApiProperty({ description: "Number of successfully completed drips" }) paidDrips: number;
  @ApiProperty({ description: "Number of remaining drips not yet completed" }) pendingDrips: number;
  @ApiProperty({ example: "Friday" }) dayOfWeek: string;
  @ApiProperty({ type: [DripEntryData] }) dripSchedule: DripEntryData[];
}

class VaultApiResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: VaultData }) data: VaultData;
}

class VaultDetailApiResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: VaultDetailData }) data: VaultDetailData;
}

class VaultListApiResponse {
  @ApiProperty() message: string;
  @ApiProperty({ type: [VaultData] }) data: VaultData[];
}

@ApiTags("Vault")
@ApiBearerAuth()
@Controller("vault")
export class VaultController {
  constructor(private readonly vaults: VaultService) {}

  @Post()
  @ApiOperation({ summary: "Create a new savings vault" })
  @ApiResponse({ status: 201, type: VaultApiResponse })
  async create(@CurrentUser() user: User, @Body() dto: CreateVaultDto) {
    return ok(VAULT_CREATED, this.toListResponse(await this.vaults.create(user.id, dto)));
  }

  @Get("me")
  @ApiOperation({ summary: "List my vaults" })
  @ApiResponse({ status: 200, type: VaultListApiResponse })
  async listMine(@CurrentUser() user: User) {
    return ok(VAULTS_FETCHED, (await this.vaults.findByUser(user.id)).map((v) => this.toListResponse(v)));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get vault detail including full drip schedule" })
  @ApiResponse({ status: 200, type: VaultDetailApiResponse })
  async getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return ok(VAULT_FETCHED, this.toDetailResponse(await this.vaults.findById(id, user.id)));
  }

  @Post(":id/break")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Break vault early",
    description: "Cancels the vault and returns remaining balance minus a 10% early-exit penalty.",
  })
  @ApiResponse({ status: 200, type: VaultApiResponse })
  async breakVault(@CurrentUser() user: User, @Param("id") id: string) {
    return ok(VAULT_BROKEN, this.toListResponse(await this.vaults.breakVault(user.id, id)));
  }

  private toListResponse(vault: VaultListItem): VaultData {
    const remaining =
      vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;
    return {
      id: vault.id,
      userId: vault.userId,
      name: vault.name,
      lockedAmountKobo: vault.lockedAmountKobo.toString(),
      trancheAmountKobo: vault.trancheAmountKobo.toString(),
      remainingKobo: remaining.toString(),
      totalTranches: vault.totalTranches,
      tranchesSent: vault.tranchesSent,
      frequency: vault.frequency.name,
      status: vault.status.name,
      startsAt: vault.startsAt,
      endsAt: vault.endsAt,
      brokenAt: vault.brokenAt,
      penaltyKobo: vault.penaltyKobo?.toString() ?? null,
      createdAt: vault.createdAt,
    };
  }

  private toDetailResponse(vault: VaultDetail): VaultDetailData {
    const remaining =
      vault.lockedAmountKobo - BigInt(vault.tranchesSent) * vault.trancheAmountKobo;

    const realByDripNumber = new Map(vault.disbursements.map((d) => [d.dripNumber, d]));
    const paidDrips = vault.disbursements.filter((d) => d.status.name === "COMPLETED").length;

    const dripSchedule: DripEntryData[] = Array.from(
      { length: vault.totalTranches },
      (_, i) => {
        const dripNumber = i + 1;
        const scheduledAt = computeScheduledAt(vault.startsAt, dripNumber, vault.frequency.name);
        const real = realByDripNumber.get(dripNumber);

        if (real) {
          return {
            id: real.id,
            dripNumber: real.dripNumber,
            amountKobo: real.amountKobo.toString(),
            scheduledAt,
            status: real.status.name,
            failReason: real.failReason,
            attemptedAt: real.attemptedAt,
            completedAt: real.completedAt,
            createdAt: real.createdAt,
          };
        }

        const isLast = dripNumber === vault.totalTranches;
        const amountKobo = isLast
          ? vault.lockedAmountKobo - BigInt(vault.totalTranches - 1) * vault.trancheAmountKobo
          : vault.trancheAmountKobo;

        return {
          id: null,
          dripNumber,
          amountKobo: amountKobo.toString(),
          scheduledAt,
          status: "SCHEDULED",
          failReason: null,
          attemptedAt: null,
          completedAt: null,
          createdAt: null,
        };
      },
    );

    return {
      id: vault.id,
      userId: vault.userId,
      name: vault.name,
      lockedAmountKobo: vault.lockedAmountKobo.toString(),
      trancheAmountKobo: vault.trancheAmountKobo.toString(),
      remainingKobo: remaining.toString(),
      totalTranches: vault.totalTranches,
      tranchesSent: vault.tranchesSent,
      paidDrips,
      pendingDrips: vault.totalTranches - paidDrips,
      frequency: vault.frequency.name,
      dayOfWeek: DAY_NAMES[vault.startsAt.getUTCDay()] as string,
      status: vault.status.name,
      startsAt: vault.startsAt,
      endsAt: vault.endsAt,
      brokenAt: vault.brokenAt,
      penaltyKobo: vault.penaltyKobo?.toString() ?? null,
      createdAt: vault.createdAt,
      dripSchedule,
    };
  }
}
