import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../prisma/prisma.module";
import { KycService } from "./service.kyc";
import { KycController } from "./controller.kyc";
import { DojahProvider } from "./providers/provider.dojah";
import { SmileProvider } from "./providers/provider.smile";

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [KycController],
  providers: [KycService, DojahProvider, SmileProvider],
  exports: [KycService],
})
export class KycModule {}
