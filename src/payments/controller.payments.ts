import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { User } from '@prisma/client';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { PaymentsService } from './service.payments';
import { FundDto } from './lib/dto/dto.payments.fund';

class FundInitResponse {
  @ApiProperty({ example: 'https://checkout.paystack.com/...' })
  authorizationUrl: string;
  @ApiProperty({ example: 'a1b2c3d4-...' })
  reference: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('fund')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initialize wallet funding',
    description: 'Returns a Paystack checkout URL. Redirect the user there to complete payment.',
  })
  @ApiResponse({ status: 201, type: FundInitResponse })
  fund(@CurrentUser() user: User, @Body() dto: FundDto): Promise<FundInitResponse> {
    return this.payments.initializeFunding(user.id, dto);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook receiver (internal)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ): Promise<{ received: boolean }> {
    await this.payments.handleWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
