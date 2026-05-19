import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersService } from "./service.users";
import { UsersController } from "./controller.users";
import { DojahProvider } from "../kyc/providers/provider.dojah";

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [UsersService, DojahProvider],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
