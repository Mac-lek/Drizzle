import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "@prisma-client/prisma.module";
import { NotificationsModule } from "@notifications/notifications.module";
import { WaitlistService } from "./service.waitlist";
import { WaitlistController } from "./controller.waitlist";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
