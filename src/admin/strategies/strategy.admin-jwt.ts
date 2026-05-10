import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma-client/prisma.service';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('ADMIN_JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AdminJwtPayload) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { resource: true } } } },
        status: { select: { name: true } },
        userPermissions: { include: { resource: true } },
      },
    });

    if (!admin || admin.status.name !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    return admin;
  }
}
