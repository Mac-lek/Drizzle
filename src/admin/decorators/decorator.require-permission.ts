import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION = "requirePermission";

export const RequirePermission = (resource: string, ...actions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION, { resource, actions });
