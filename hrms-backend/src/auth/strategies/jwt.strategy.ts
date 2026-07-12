import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  companyId: string | null;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Fast path: query only for user existence and employeeId — roles & permissions
    // come from the JWT payload (populated by AuthService.issueTokenPair).
    // This avoids an expensive N+1 join query on every authenticated request.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        companyId: true,
        email: true,
        status: true,
        deletedAt: true,
        employee: { select: { id: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('User is inactive or no longer exists.');
    }

    // Use roles/permissions from JWT payload (freshest when issued at login)
    let roles = payload.roles ?? [];
    let permissions = payload.permissions ?? [];

    // Fallback: if JWT payload lacks roles or permissions (e.g. old tokens issued
    // before the fix, or DB error during token issuance), load from DB to avoid
    // breaking existing sessions or auth failures.
    if (roles.length === 0 || permissions.length === 0) {
      const fullUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          userRoles: {
            select: {
              role: {
                select: {
                  slug: true,
                  rolePermissions: {
                    select: { permission: { select: { code: true } } },
                  },
                },
              },
            },
          },
        },
      });
      if (fullUser) {
        roles = fullUser.userRoles.map((ur) => ur.role.slug);
        permissions = Array.from(
          new Set(
            fullUser.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
          ),
        );
      }
    }

    return {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      employeeId: user.employee?.id ?? null,
      roles,
      permissions,
    };
  }
}
