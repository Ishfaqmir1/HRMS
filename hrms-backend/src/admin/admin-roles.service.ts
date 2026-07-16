import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminRolesService {
  private readonly logger = new Logger(AdminRolesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * List all platform-level roles (companyId: null, system roles).
   */
  async findAll() {
    return this.prisma.role.findMany({
      where: { companyId: null },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a single platform role with its permissions.
   */
  async findOne(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    });
    if (!role) throw new NotFoundException('Platform role not found.');
    return role;
  }

  /**
   * List all permissions grouped by module.
   */
  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      grouped[p.module] = grouped[p.module] || [];
      grouped[p.module].push(p);
    }
    return grouped;
  }

  /**
   * Create a new platform role.
   */
  async create(dto: { name: string; slug: string; description?: string; permissionCodes?: string[] }) {
    const existing = await this.prisma.role.findUnique({
      where: { companyId_slug: { companyId: null as any, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('A role with this slug already exists.');

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          isSystem: true,
        },
      });

      if (dto.permissionCodes?.length) {
        const permissions = await tx.permission.findMany({
          where: { code: { in: dto.permissionCodes } },
        });
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: {
          rolePermissions: { include: { permission: true } },
          _count: { select: { userRoles: true } },
        },
      });
    });
  }

  /**
   * Update a platform role's metadata (name, description).
   */
  async update(roleId: string, dto: { name?: string; description?: string }) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
    });
    if (!role) throw new NotFoundException('Platform role not found.');

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: { ...dto },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return updated;
  }

  /**
   * Update permissions for a platform role.
   */
  async setPermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
    });
    if (!role) throw new NotFoundException('Platform role not found.');

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          rolePermissions: { include: { permission: true } },
          _count: { select: { userRoles: true } },
        },
      });
    });
  }

  /**
   * Delete a platform role.
   */
  async remove(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId: null },
    });
    if (!role) throw new NotFoundException('Platform role not found.');

    // Check if any users are assigned this role
    const userCount = await this.prisma.userRole.count({ where: { roleId } });
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role "${role.name}" — ${userCount} user(s) are assigned to it. Revoke all assignments first.`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    this.logger.log(`Platform role deleted: ${role.name}`);
    return { message: 'Platform role deleted successfully.' };
  }
}
