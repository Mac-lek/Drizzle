import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().admin,
);
