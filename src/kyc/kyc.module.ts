import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../prisma/prisma.module";
import { KycService } from "./service.kyc";
import { KycController } from "./controller.kyc";
import { SmileProvider } from "./providers/provider.smile";

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [KycController],
  providers: [KycService, SmileProvider],
  exports: [KycService],
})
export class KycModule {}
