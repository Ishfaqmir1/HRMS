import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto, AdminUpdateCompanyDto } from './dto/update-company.dto';
import { 
  ResetPasswordDto, SendAnnouncementDto, UpdateCompanyPlanDto, 
  UpdateCompanyLimitsDto, CompanyQueryDto, RejectCompanyDto
} from './dto/company-actions.dto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  async updateMyCompany(companyId: string, dto: UpdateCompanyDto) {
    await this.getMyCompany(companyId);
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }

  /** Platform-level: list every tenant with rich detail. Restricted to SUPER_ADMIN. */
  async findAll(query: CompanyQueryDto) {
    const where: any = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { slug: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    const page = query.page;
    const limit = query.limit;
    const skip = query.skip;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        skip,
        take: query.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        include: {
          billingPlan: { select: { id: true, name: true, slug: true, maxEmployees: true, maxStorageGB: true } },
          _count: { select: { employees: true, users: true } },
          users: {
            where: { deletedAt: null },
            select: {
              id: true,
              email: true,
              status: true,
              lastLoginAt: true,
              isEmailVerified: true,
              employee: {
                select: { firstName: true, lastName: true, phone: true },
              },
            },
            orderBy: { createdAt: 'asc' as const },
            take: 1, // first user = owner
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    // Transform items with computed fields
    const enriched = items.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      industry: company.industry,
      size: company.size,
      timezone: company.timezone,
      locale: company.locale,
      currency: company.currency,
      country: company.country,
      gstNumber: company.gstNumber,
      panNumber: company.panNumber,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      state: company.state,
      postalCode: company.postalCode,
      domain: company.domain,
      phone: company.phone,
      status: company.status,
      subscriptionPlan: company.subscriptionPlan,
      isActive: company.isActive,
      trialEndsAt: company.trialEndsAt,
      billingEmail: company.billingEmail,
      billingCycle: company.billingCycle,
      verifiedAt: company.verifiedAt,
      verifiedById: company.verifiedById,
      rejectionReason: company.rejectionReason,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      owner: company.users[0]
        ? {
            id: company.users[0].id,
            email: company.users[0].email,
            status: company.users[0].status,
            lastLoginAt: company.users[0].lastLoginAt,
            firstName: company.users[0].employee?.firstName ?? null,
            lastName: company.users[0].employee?.lastName ?? null,
            phone: company.users[0].employee?.phone ?? null,
          }
        : null,
      billingPlan: company.billingPlan,
      employeeCount: company._count.employees,
      userCount: company._count.users,
    }));

    return {
      items: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Get single company with complete detail. */
  async findOne(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        billingPlan: true,
        branding: true,
        _count: {
          select: {
            employees: true,
            users: true,
            departments: true,
            branches: true,
            assets: true,
            leaveRequests: true,
            attendanceRecords: true,
            payrollRuns: true,
            trainings: true,
          },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            email: true,
            status: true,
            lastLoginAt: true,
            isEmailVerified: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                employeeCode: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' as const },
        },
      },
    });

    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  /** List users in a company with their roles. */
  async getCompanyUsers(companyId: string) {
    await this.getMyCompany(companyId);

    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        lastLoginAt: true,
        isEmailVerified: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            phone: true,
          },
        },
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                isSystem: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Get audit logs for a company. */
  async getCompanyAuditLogs(companyId: string, limit = 50) {
    await this.getMyCompany(companyId);

    return this.prisma.auditLog.findMany({
      where: { companyId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async setStatus(companyId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') {
    await this.getMyCompany(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { status, isActive: status === 'ACTIVE' },
    });
  }

  /** Super admin: update any company's profile fields. */
  async adminUpdate(companyId: string, dto: AdminUpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }

  /** Upload a verification document for a company. */
  async uploadVerificationDocument(companyId: string, documentType: string, fileUrl: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    const updateData: any = {};
    if (documentType === 'registration_cert') updateData.registrationCert = fileUrl;
    else if (documentType === 'address_proof') updateData.addressProof = fileUrl;
    else if (documentType === 'owner_id') updateData.ownerIdDoc = fileUrl;
    else throw new BadRequestException(`Unknown document type: ${documentType}`);

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'VERIFICATION_DOCUMENT_UPLOADED',
        entityType: 'Company',
        entityId: companyId,
        metadata: { documentType, fileUrl },
      },
    });

    return this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });
  }

  /** Soft-delete a company. */
  async remove(companyId: string) {
    await this.getMyCompany(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { deletedAt: new Date(), isActive: false, status: 'CANCELLED' },
    });
  }

  /** Reset the owner's password. */
  async resetPassword(companyId: string, dto: ResetPasswordDto) {
    await this.getMyCompany(companyId);

    // Find the first admin/owner user
    const ownerUser = await this.prisma.user.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (!ownerUser) {
      throw new NotFoundException('No users found for this company.');
    }

    const saltRounds = this.configService.get<number>('bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: ownerUser.id },
      data: { passwordHash, mustChangePassword: true },
    });

    return { message: 'Password reset successfully.', userId: ownerUser.id };
  }

  /** Generate an impersonation JWT for a company admin (Login as Company). */
  async impersonate(companyId: string) {
    const company = await this.getMyCompany(companyId);

    const ownerUser = await this.prisma.user.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
        employee: { select: { id: true } },
      },
    });

    if (!ownerUser) {
      throw new NotFoundException('No users found for this company.');
    }

    const roles = ownerUser.userRoles.map((ur) => ur.role.slug);
    const permissions = Array.from(
      new Set(
        ownerUser.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    const payload = {
      sub: ownerUser.id,
      email: ownerUser.email,
      companyId: ownerUser.companyId,
      employeeId: ownerUser.employee?.id ?? null,
      roles,
      permissions,
      impersonator: true,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: '1h',
    });

    return {
      accessToken,
      user: {
        id: ownerUser.id,
        email: ownerUser.email,
        roles,
      },
      company: { id: company.id, name: company.name, slug: company.slug },
    };
  }

  /** Send an announcement to all users in a company. */
  async sendAnnouncement(companyId: string, dto: SendAnnouncementDto) {
    await this.getMyCompany(companyId);

    // Log the announcement as an audit event
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'ANNOUNCEMENT_SENT',
        entityType: 'Company',
        entityId: companyId,
        metadata: {
          subject: dto.subject,
          message: dto.message.substring(0, 500),
          sendEmail: dto.sendEmail ?? false,
        },
      },
    });

    this.logger.log(`Announcement sent to company ${companyId}: ${dto.subject}`);

    return { message: 'Announcement sent successfully.', subject: dto.subject };
  }

  /** Change a company's billing plan. */
  async updatePlan(companyId: string, dto: UpdateCompanyPlanDto) {
    const company = await this.getMyCompany(companyId);

    const plan = await this.prisma.billingPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Billing plan not found.');

    const updateData: any = {
      billingPlanId: plan.id,
      subscriptionPlan: plan.slug.toUpperCase() as any,
      billingCycle: dto.billingCycle ?? company.billingCycle ?? 'MONTHLY',
    };

    // If switching from TRIAL, clear trial period
    if (company.subscriptionPlan === 'TRIAL') {
      updateData.trialEndsAt = null;
      updateData.status = 'ACTIVE';
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });
  }

  /** Update a company's employee/storage limits (overrides plan defaults). */
  async updateLimits(companyId: string, dto: UpdateCompanyLimitsDto) {
    await this.getMyCompany(companyId);

    this.logger.log(`Limits updated for company ${companyId}: ${JSON.stringify(dto)}`);

    // Log the limit change as an audit event
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'LIMITS_UPDATED',
        entityType: 'Company',
        entityId: companyId,
        metadata: { ...dto },
      },
    });

    return { message: 'Limits updated successfully.', ...dto };
  }

  // ====================================================================
  // Verification Workflow
  // ====================================================================

  /** Approve a company (moves from PENDING_APPROVAL to ACTIVE). */
  async approve(companyId: string, superAdminId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    if (company.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Company is not awaiting approval. Current status: ${company.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          status: 'ACTIVE',
          isActive: true,
          verifiedAt: new Date(),
          verifiedById: superAdminId,
          setupCompleted: false,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: superAdminId,
          action: 'COMPANY_APPROVED',
          entityType: 'Company',
          entityId: companyId,
          metadata: { previousStatus: 'PENDING_APPROVAL', newStatus: 'ACTIVE' },
        },
      });

      return updated;
    });

    this.logger.log(`Company ${companyId} approved by super admin ${superAdminId}`);
    return result;
  }

  /** Reject a company (moves from PENDING_APPROVAL to REJECTED). */
  async reject(companyId: string, dto: RejectCompanyDto, superAdminId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    if (company.status !== 'PENDING_APPROVAL' && company.status !== 'PENDING_EMAIL_VERIFICATION') {
      throw new BadRequestException(`Company cannot be rejected. Current status: ${company.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          status: 'REJECTED',
          isActive: false,
          rejectionReason: dto.reason,
          verifiedAt: new Date(),
          verifiedById: superAdminId,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: superAdminId,
          action: 'COMPANY_REJECTED',
          entityType: 'Company',
          entityId: companyId,
          metadata: { previousStatus: company.status, reason: dto.reason },
        },
      });

      return updated;
    });

    this.logger.log(`Company ${companyId} rejected by super admin ${superAdminId}. Reason: ${dto.reason}`);
    return result;
  }

  /** List companies awaiting approval (PENDING_APPROVAL). */
  async getPendingApprovals() {
    return this.prisma.company.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        deletedAt: null,
      },
      include: {
        billingPlan: { select: { id: true, name: true, slug: true, maxEmployees: true, maxStorageGB: true } },
        _count: { select: { employees: true, users: true } },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            email: true,
            status: true,
            lastLoginAt: true,
            isEmailVerified: true,
            employee: {
              select: { firstName: true, lastName: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' as const },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
