import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, AssignPermissionsDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /** All permissions available in the system, grouped by module — used to build role-editor UIs. */
  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      grouped[p.module] = grouped[p.module] || [];
      grouped[p.module].push(p);
    }
    return grouped;
  }

  /** Roles visible to a tenant: its own custom roles + the global system role templates. */
  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, OR: [{ companyId }, { companyId: null }] },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found.');
    return role;
  }

  async create(companyId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { companyId_slug: { companyId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('A role with this slug already exists in your company.');

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { companyId, name: dto.name, slug: dto.slug, description: dto.description, isSystem: false },
      });

      if (dto.permissionCodes?.length) {
        const permissions = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async updateMetadata(companyId: string, roleId: string, dto: CreateRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Custom role not found.');
    if (role.isSystem) throw new ConflictException('System roles cannot be modified.');

    const existing = await this.prisma.role.findFirst({
      where: { companyId, slug: dto.slug, id: { not: roleId } },
    });
    if (existing) throw new ConflictException('Another role with this slug already exists.');

    return this.prisma.role.update({
      where: { id: roleId },
      data: { name: dto.name, slug: dto.slug, description: dto.description },
    });
  }

  async setPermissions(companyId: string, roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Custom role not found (system roles cannot be edited).');
    if (role.isSystem) throw new ConflictException('System role permissions cannot be modified directly.');

    const permissions = await this.prisma.permission.findMany({ where: { code: { in: dto.permissionCodes } } });

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async remove(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Custom role not found.');
    if (role.isSystem) throw new ConflictException('System roles cannot be deleted.');
    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: 'Role deleted.' };
  }

  /** Assigns a role (system or custom) to a user within the same tenant. */
  async assignRoleToUser(companyId: string, userId: string, roleId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('User not found in this company.');

    const role = await this.prisma.role.findFirst({ where: { id: roleId, OR: [{ companyId }, { companyId: null }] } });
    if (!role) throw new NotFoundException('Role not found or not available to this company.');

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async revokeRoleFromUser(companyId: string, userId: string, roleId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('User not found in this company.');
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    return { message: 'Role revoked.' };
  }
}
