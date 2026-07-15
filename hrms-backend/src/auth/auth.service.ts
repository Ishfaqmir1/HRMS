import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginSecurityService } from '../common/services/login-security.service';
import { AuditService } from '../common/services/audit.service';
import { RegisterDto, VerifyEmailDto } from './dto/register.dto';
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
    private loginSecurity: LoginSecurityService,
    private auditService: AuditService,
  ) {}

  /**
   * Registers a brand-new tenant (company) along with its first user, who is
   * automatically assigned the COMPANY_OWNER role.
   * Company is created in PENDING_EMAIL_VERIFICATION status — email verification
   * is required before super admin can approve the company.
   */
  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase();

    const existingCompany = await this.prisma.company.findUnique({
      where: { slug: dto.companySlug },
    });
    if (existingCompany) {
      throw new ConflictException('This company slug is already taken.');
    }

    // Global email uniqueness check — the same email cannot register
    // across different companies (prevents duplicate accounts).
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });
    if (existingUser) {
      throw new ConflictException(
        'This email is already registered with another workspace. Please sign in instead.',
      );
    }

    const ownerRole = await this.prisma.role.findFirst({
      where: { companyId: null, slug: 'company-owner', isSystem: true },
    });
    if (!ownerRole) {
      throw new Error('System role "company-owner" is missing. Run prisma db seed first.');
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // If a billingPlanId was provided during signup, validate it exists
    let billingPlanId: string | null = null;
    if (dto.billingPlanId) {
      const plan = await this.prisma.billingPlan.findUnique({
        where: { id: dto.billingPlanId, isActive: true },
      });
      if (!plan) {
        throw new BadRequestException('Selected billing plan not found or is inactive.');
      }
      billingPlanId = plan.id;
    }

    // The transaction is wrapped in a try-catch for Prisma P2002 (unique constraint
    // violation) as a safety net against race conditions between the pre-transaction
    // checks above and the actual inserts below.
    let result: { company: any; user: any; employee: any };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.companyName,
            slug: dto.companySlug,
            industry: dto.industry ?? null,
            size: dto.size ?? null,
            country: dto.country ?? null,
            timezone: dto.timezone ?? 'UTC',
            currency: dto.currency ?? 'USD',
            gstNumber: dto.gstNumber ?? null,
            panNumber: dto.panNumber ?? null,
            phone: dto.phone ?? null,
            domain: dto.domain ?? null,
            billingPlanId,
            status: 'PENDING_EMAIL_VERIFICATION',
            isActive: false,
          },
        });

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: normalizedEmail,
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
            phone: dto.phone ?? null,
            dateOfJoining: new Date(),
          },
        });

        // Audit: company registration
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: user.id,
            action: 'COMPANY_REGISTERED',
            entityType: 'Company',
            entityId: company.id,
            metadata: { status: 'PENDING_EMAIL_VERIFICATION' },
          },
        });

        return { company, user, employee };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          // Unique constraint violation — map slug vs email to friendly messages
          const target = (err.meta?.target as string[]) ?? [];
          const targetStr = target.join(',');

          if (targetStr.includes('slug')) {
            throw new ConflictException(
              'This company slug is already taken. Please choose another one.',
            );
          }

          if (targetStr.includes('email')) {
            throw new ConflictException(
              'This email is already registered with another workspace. Please sign in instead.',
            );
          }

          throw new ConflictException(
            'A conflict occurred during registration. Please try again with different details.',
          );
        }

        if (err.code === 'P2003') {
          // Foreign key violation — likely references missing seed data
          throw new BadRequestException(
            'Registration cannot be completed at this time. Please contact support.',
          );
        }
      }
      // Re-throw non-P2002/P2003 errors as-is (global filter will handle)
      throw err;
    }

    const tokens = await this.issueTokenPair(result.user.id, result.user.email, result.company.id);
    return {
      company: { id: result.company.id, name: result.company.name, slug: result.company.slug },
      user: { id: result.user.id, email: result.user.email },
      ...tokens,
    };
  }

  /**
   * Verify a company owner's email address using a verification token.
   * On success the company moves from PENDING_EMAIL_VERIFICATION to PENDING_APPROVAL.
   */
  async verifyEmail(dto: VerifyEmailDto) {
    // Decode the verification token to get the userId
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify(dto.token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    if (payload.type !== 'email_verify') {
      throw new BadRequestException('Invalid token type.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark user as email verified
      await tx.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });

      // Move company to PENDING_APPROVAL if it's still in PENDING_EMAIL_VERIFICATION
      if (user.company && user.company.status === 'PENDING_EMAIL_VERIFICATION') {
        await tx.company.update({
          where: { id: user.company.id },
          data: { status: 'PENDING_APPROVAL' },
        });

        await tx.auditLog.create({
          data: {
            companyId: user.company.id,
            userId: user.id,
            action: 'EMAIL_VERIFIED',
            entityType: 'Company',
            entityId: user.company.id,
            metadata: { newStatus: 'PENDING_APPROVAL' },
          },
        });
      }
    });

    return {
      message: 'Email verified successfully.',
      status: user.company?.status === 'PENDING_EMAIL_VERIFICATION' ? 'PENDING_APPROVAL' : 'VERIFIED',
    };
  }

  /**
   * Generate an email verification token for the current user.
   */
  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found.');

    if (user.isEmailVerified) {
      return { message: 'Email is already verified.', alreadyVerified: true };
    }

    const token = this.jwtService.sign(
      { sub: userId, type: 'email_verify' },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: '24h',
      },
    );

    this.logger.log(`Verification email token generated for user ${userId}`);
    // TODO: Send actual email with the verification link
    // The link would be: https://app.example.com/verify-email?token=${token}

    return {
      message: 'Verification email sent.',
      // In development, return the token for testing
      ...(process.env.NODE_ENV !== 'production' ? { devToken: token } : {}),
    };
  }

  /**
   * Authenticates a user with login security: failed attempt tracking,
   * temp lockout, and audit logging.
   */
  async login(dto: LoginDto, meta?: { ipAddress?: string; userAgent?: string }) {
    const normalizedEmail = dto.email.toLowerCase();

    // ─── Check account lockout ───────────────────────────────────────
    const isLocked = await this.loginSecurity.isLocked(normalizedEmail);
    if (isLocked) {
      const remaining = await this.loginSecurity.getRemainingLockoutMinutes(normalizedEmail);
      throw new HttpException(
        `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let companyId: string | null = null;

    if (dto.companySlug) {
      const company = await this.prisma.company.findUnique({ where: { slug: dto.companySlug } });
      if (!company) {
        throw new UnauthorizedException('Invalid company, credentials, or account is inactive.');
      }
      if (!company.isActive) {
        if (company.status === 'PENDING_EMAIL_VERIFICATION') {
          throw new UnauthorizedException(
            'Please verify your email address before logging in. Check your inbox for the verification link.',
          );
        }
        if (company.status === 'PENDING_APPROVAL') {
          throw new UnauthorizedException(
            'Your company registration is pending approval from the platform administrator. You will be notified once approved.',
          );
        }
        if (company.status === 'REJECTED') {
          throw new UnauthorizedException(
            `Your company registration has been rejected${company.rejectionReason ? `: ${company.rejectionReason}` : ''}. Please contact support for assistance.`,
          );
        }
        throw new UnauthorizedException('Your company account is inactive. Please contact support.');
      }
      companyId = company.id;
    }

    const user = await this.prisma.user.findFirst({
      where: { companyId, email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      // Record failed attempt even for non-existent users (prevents email enumeration)
      await this.loginSecurity.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      // Record failed attempt
      const { remainingAttempts, locked } = await this.loginSecurity.recordFailedAttempt(normalizedEmail);

      // Audit: failed login
      await this.auditService.log(
        { userId: user.id, companyId: user.companyId, email: normalizedEmail } as any,
        {
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          metadata: { remainingAttempts, locked, ipAddress: meta?.ipAddress },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      );

      if (locked) {
        throw new HttpException(
          `Account locked due to too many failed attempts. Try again in ${this.configService.get<number>('loginSecurity.lockoutDurationMinutes')} minute(s).`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}.`);
    }

    // ─── Login successful: reset attempts, update lastLogin, audit ──
    await this.loginSecurity.resetAttempts(normalizedEmail);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log(
      { userId: user.id, companyId: user.companyId, email: normalizedEmail } as any,
      {
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    );

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

  /**
   * Returns the authenticated user's core context: userId, email, companyId,
   * employeeId, roles, and permissions. Used by the frontend AuthProvider
   * to initialize its permission-aware state without decoding the JWT locally.
   */
  async getMe(userId: string) {
    return this.loadUserPermissions(userId);
  }

  /**
   * Shared re-usable method that fetches user + roles + permissions.
   * Used by getMe(), issueTokenPair(), and JwtStrategy fallback.
   * Single query pattern — no duplicate Prisma calls across auth flows.
   */
  private async loadUserPermissions(userId: string): Promise<{
    userId: string;
    email: string;
    companyId: string | null;
    employeeId: string | null;
    roles: string[];
    permissions: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        companyId: true,
        employee: { select: { id: true } },
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

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const roles = user.userRoles.map((ur) => ur.role.slug);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((p) => p.permission.code)),
      ),
    );

    return {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      employeeId: user.employee?.id ?? null,
      roles,
      permissions,
    };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    companyId: string | null,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    // Fetch user's roles, permissions, and employeeId to embed in JWT payload
    // so the frontend fallback decodeJwt() and the PermissionsGuard can work
    // without an extra /auth/me call.
    let roles: string[] = [];
    let permissions: string[] = [];
    let employeeId: string | null = null;
    try {
      const result = await this.loadUserPermissions(userId);
      roles = result.roles;
      permissions = result.permissions;
      employeeId = result.employeeId;
    } catch (err) {
      this.logger.warn(`Failed to load roles/permissions for JWT payload: ${(err as Error).message}`);
    }

    const payload = { sub: userId, email, companyId, employeeId, roles, permissions };

    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn')!;
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;

    const signOptions = {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn as unknown as `${number}${'s'|'m'|'h'|'d'}`,
    };
    const refreshSignOptions = {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn as unknown as `${number}${'s'|'m'|'h'|'d'}`,
    };

    const accessToken = this.jwtService.sign(payload, signOptions);
    const refreshToken = this.jwtService.sign(payload, refreshSignOptions);

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
