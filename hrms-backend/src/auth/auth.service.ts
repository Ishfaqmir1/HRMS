import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Registers a brand-new tenant (company) along with its first user, who is
   * automatically assigned the COMPANY_OWNER role. This is the SaaS
   * self-signup flow.
   */
  async register(dto: RegisterDto) {
    const existingCompany = await this.prisma.company.findUnique({
      where: { slug: dto.companySlug },
    });
    if (existingCompany) {
      throw new ConflictException('This company slug is already taken.');
    }

    const ownerRole = await this.prisma.role.findFirst({
      where: { companyId: null, slug: 'company-owner', isSystem: true },
    });
    if (!ownerRole) {
      throw new Error('System role "company-owner" is missing. Run prisma db seed first.');
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          slug: dto.companySlug,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          status: 'ACTIVE',
          isEmailVerified: false,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: ownerRole.id },
      });

      const employee = await tx.employee.create({
        data: {
          companyId: company.id,
          userId: user.id,
          employeeCode: 'EMP-0001',
          firstName: dto.firstName,
          lastName: dto.lastName,
          workEmail: dto.email.toLowerCase(),
          dateOfJoining: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          action: 'COMPANY_REGISTERED',
          entityType: 'Company',
          entityId: company.id,
        },
      });

      return { company, user, employee };
    });

    const tokens = await this.issueTokenPair(result.user.id, result.user.email, result.company.id);
    return {
      company: { id: result.company.id, name: result.company.name, slug: result.company.slug },
      user: { id: result.user.id, email: result.user.email },
      ...tokens,
    };
  }

  /**
   * Authenticates a user. Tenant users must supply companySlug (email is only
   * unique per-company); the platform Super Admin logs in without one.
   */
  async login(dto: LoginDto, meta?: { ipAddress?: string; userAgent?: string }) {
    let companyId: string | null = null;

    if (dto.companySlug) {
      const company = await this.prisma.company.findUnique({ where: { slug: dto.companySlug } });
      if (!company || !company.isActive) {
        throw new UnauthorizedException('Invalid company, credentials, or account is inactive.');
      }
      companyId = company.id;
    }

    const user = await this.prisma.user.findFirst({
      where: { companyId, email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}.`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.companyId, meta);
    return { user: { id: user.id, email: user.email, companyId: user.companyId }, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid, expired, or has been revoked.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is inactive or no longer exists.');
    }

    // Rotate: revoke the used refresh token and issue a brand-new pair.
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.email, user.companyId);
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully.' };
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out from all devices.' };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    companyId: string | null,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, companyId };

    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn')!;
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.addDuration(new Date(), refreshExpiresIn),
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Parses simple durations like "7d", "15m", "1h" relative to a base date. */
  private addDuration(base: Date, duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000); // fallback 7d
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return new Date(base.getTime() + value * multiplier);
  }
}
