import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../prisma/prisma.module";
import { HealthController } from "./controller.health";
import { PrismaHealthIndicator } from "./indicators/indicator.prisma-health";

@Module({
  imports: [TerminusModule, HttpModule, PrismaModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
