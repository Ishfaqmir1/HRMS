import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * List all platform-level users (users with no companyId / super admins).
   */
  async findAll() {
    const platformRoles = await this.prisma.role.findMany({
      where: { companyId: null, systemRole: { not: null } },
      select: { id: true, slug: true, name: true, systemRole: true },
    });

    const platformRoleIds = platformRoles.map((r) => r.id);

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        userRoles: { some: { roleId: { in: platformRoleIds } } },
      },
      select: {
        id: true,
        email: true,
        status: true,
        isEmailVerified: true,
        lastLoginAt: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                systemRole: true,
                isSystem: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((ur) => ur.role),
    }));
  }

  /**
   * Get a single platform user by ID.
   */
  async findOne(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        isEmailVerified: true,
        lastLoginAt: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                systemRole: true,
                isSystem: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Platform user not found.');
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role),
    };
  }

  /**
   * Create a new platform user (super admin).
   */
  async create(dto: { email: string; password: string; roleId?: string }) {
    // Check if user already exists
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('A user with this email already exists.');

    const saltRounds = this.configService.get<number>('bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Find the super-admin role if not specified
    let roleId = dto.roleId;
    if (!roleId) {
      const superAdminRole = await this.prisma.role.findFirst({
        where: { companyId: null, slug: 'super-admin' },
      });
      if (!superAdminRole) throw new NotFoundException('Super admin role not found. Run seed first.');
      roleId = superAdminRole.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        status: 'ACTIVE',
        isEmailVerified: true,
        userRoles: {
          create: { roleId },
        },
      },
      select: {
        id: true,
        email: true,
        status: true,
        isEmailVerified: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true, slug: true, systemRole: true, isSystem: true } },
          },
        },
      },
    });

    this.logger.log(`Platform user created: ${dto.email}`);
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role),
    };
  }

  /**
   * Update a platform user's status (activate/suspend).
   */
  async updateStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Platform user not found.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    this.logger.log(`Platform user ${user.email} status updated to ${status}`);
    return {
      ...updated,
      roles: updated.userRoles.map((ur) => ur.role),
    };
  }

  /**
   * Remove a platform user (soft delete).
   */
  async remove(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Platform user not found.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
    });

    this.logger.log(`Platform user ${user.email} deleted`);
    return { message: 'Platform user removed successfully.' };
  }

  /**
   * Assign a role to a platform user.
   */
  async assignRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Platform user not found.');

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
    });
    if (!role) throw new NotFoundException('Platform role not found.');

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
      include: {
        role: { select: { id: true, name: true, slug: true, systemRole: true, isSystem: true } },
      },
    });
  }

  /**
   * Revoke a role from a platform user.
   */
  async revokeRole(userId: string, roleId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Platform user not found.');

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
    });
    if (!role) throw new NotFoundException('Platform role not found.');

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    return { message: 'Role revoked successfully.' };
  }
}
