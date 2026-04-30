import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { WalletService } from './service.wallet';
import { koboToString } from '@common/lib/utils/util.money';

class WalletResponse {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ nullable: true }) paystackCustomerCode: string | null;
  @ApiProperty({ nullable: true }) paystackVirtualAcctNo: string | null;
  @ApiProperty({ nullable: true }) paystackVirtualBankName: string | null;
  @ApiProperty({ description: 'Balance in Kobo (1 Naira = 100 Kobo)', example: '0' })
  balanceKobo: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my wallet details and current balance' })
  @ApiResponse({ status: 200, type: WalletResponse })
  async getMyWallet(@CurrentUser() user: User): Promise<WalletResponse> {
    const w = await this.wallet.findByUserId(user.id);
    const balanceKobo = await this.wallet.getBalance(w.id);

    return {
      id: w.id,
      userId: w.userId,
      paystackCustomerCode: w.paystackCustomerCode,
      paystackVirtualAcctNo: w.paystackVirtualAcctNo,
      paystackVirtualBankName: w.paystackVirtualBankName,
      balanceKobo: koboToString(balanceKobo),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }
}
