import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION } from '../decorators/decorator.require-permission';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.get<{ resource: string; actions: string[] }>(
      REQUIRE_PERMISSION,
      context.getHandler(),
    );

    if (!meta) return true;

    const admin = context.switchToHttp().getRequest().admin;

    // SADM bypasses all permission checks
    if (admin.role.code === 'SADM') return true;

    const { resource, actions } = meta;

    const rolePerms = (admin.role.permissions as Array<{ resource: { name: string }; permissions: string }>)
      .find((p) => p.resource.name === resource)
      ?.permissions.split(',') ?? [];

    const userPerms = (admin.userPermissions as Array<{ resource: { name: string }; permissions: string }>)
      .find((p) => p.resource.name === resource)
      ?.permissions.split(',') ?? [];

    const granted = new Set([...rolePerms, ...userPerms]);
    const allowed = actions.every((a) => granted.has(a));

    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
