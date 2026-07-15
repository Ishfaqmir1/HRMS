import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/admin-settings.dto';

@Injectable()
export class AdminAuditService {
  constructor(private prisma: PrismaService) {}

  async getAuditLogs(query: AuditLogQueryDto) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { company: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.action) {
      where.action = { equals: query.action, mode: 'insensitive' };
    }

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.entityType) {
      where.entityType = { equals: query.entityType, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          company: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: log.user
          ? {
              email: log.user.email,
              name: log.user.employee
                ? `${log.user.employee.firstName} ${log.user.employee.lastName}`
                : null,
            }
          : null,
        company: log.company
          ? {
              id: log.company.id,
              name: log.company.name,
              slug: log.company.slug,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditLogStats() {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total counts
    const totalLogs = await this.prisma.auditLog.count();
    const todayLogs = await this.prisma.auditLog.count({
      where: { createdAt: { gte: todayStart } },
    });
    const last30DaysLogs = await this.prisma.auditLog.count({
      where: { createdAt: { gte: last30Days } },
    });

    // Action type distribution
    const actionCounts = await this.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 20,
    });

    // Entity type distribution
    const entityTypeCounts = await this.prisma.auditLog.groupBy({
      by: ['entityType'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 15,
    });

    // Daily activity for last 30 days
    const dailyActivity = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM audit_logs
      WHERE "createdAt" >= ${last30Days}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Unique companies active
    const activeCompanies = await this.prisma.auditLog.groupBy({
      by: ['companyId'],
      where: { createdAt: { gte: last30Days }, companyId: { not: null } },
      _count: { _all: true },
    });

    return {
      totalLogs,
      todayLogs,
      last30DaysLogs,
      actionCounts: actionCounts.map((a) => ({
        action: a.action,
        count: a._count._all,
      })),
      entityTypeCounts: entityTypeCounts.map((e) => ({
        entityType: e.entityType ?? 'UNKNOWN',
        count: e._count._all,
      })),
      dailyActivity: dailyActivity.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      activeCompaniesLast30Days: activeCompanies.length,
    };
  }

  async getDistinctActions() {
    const result = await this.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
    });
    return result.map((r) => ({
      action: r.action,
      count: r._count._all,
    }));
  }
}
