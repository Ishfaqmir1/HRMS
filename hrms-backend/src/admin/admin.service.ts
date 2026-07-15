import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

    // ── Run all aggregate queries in parallel ──────────────────────
    const [
      companyCounts,
      userStats,
      employeeCount,
      usersLoggedInToday,
      newCompaniesThisWeek,
      activeEmployeeCount,
      latestCompanies,
      latestAuditLogs,
      latestPayslips,
      payrollRevenue,
      topCompaniesByEmployees,
      topCompaniesByUsers,
    ] = await Promise.all([
      // Company counts by status
      this.prisma.company.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // User stats
      this.prisma.user.aggregate({
        _count: { id: true },
        where: { deletedAt: null, status: 'ACTIVE' },
      }),

      // Total employees (non-deleted, non-terminated)
      this.prisma.employee.count({
        where: { deletedAt: null, status: { not: 'TERMINATED' } },
      }),

      // Users who logged in today
      this.prisma.user.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // New companies this week
      this.prisma.company.count({
        where: { deletedAt: null, createdAt: { gte: weekAgo } },
      }),

      // Active employees (status = ACTIVE)
      this.prisma.employee.count({
        where: { deletedAt: null, status: 'ACTIVE' },
      }),

      // Latest 10 registered companies
      this.prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          subscriptionPlan: true,
          _count: { select: { employees: true } },
          users: {
            where: { deletedAt: null },
            select: { email: true, lastLoginAt: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      }),

      // Latest 10 audit logs
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          companyId: true,
          user: {
            select: {
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),

      // Latest 10 payslips (payments)
      this.prisma.payslip.findMany({
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          netPay: true,
          grossPay: true,
          paidAt: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true,
              company: { select: { name: true } },
            },
          },
        },
      }),

      // Payroll revenue this month — sum of netPay from completed runs
      this.prisma.payrollRun.aggregate({
        _sum: { totalNet: true, totalGross: true },
        where: {
          status: 'COMPLETED',
          processedAt: { gte: monthStart },
        },
      }),

      // Top 10 companies by employee count
      this.prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { employees: { _count: 'desc' } },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionPlan: true,
          _count: { select: { employees: true } },
        },
      }),

      // Top companies by user count (proxy for "storage usage")
      this.prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { users: { _count: 'desc' } },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { users: true } },
        },
      }),
    ]);

    // ── Compute derived metrics ──────────────────────────────────

    const totalCompanies = companyCounts.reduce((sum, row) => sum + row._count._all, 0);
    const activeCompanies = companyCounts.find((r) => r.status === 'ACTIVE')?._count._all ?? 0;
    const expiredCount = companyCounts.find((r) => r.status === 'TRIAL_EXPIRED')?._count._all ?? 0;
    const suspendedCount = companyCounts.find((r) => r.status === 'SUSPENDED')?._count._all ?? 0;

    const trialCount = await this.prisma.company.count({
      where: { deletedAt: null, subscriptionPlan: 'TRIAL' },
    });

    // Revenue metrics
    const monthlyRevenue = payrollRevenue._sum.totalNet ?? 0;
    const monthlyGross = payrollRevenue._sum.totalGross ?? 0;

    // Estimated MRR from subscriptions (billing plan prices * companies)
    const subscriptionsWithPlans = await this.prisma.company.findMany({
      where: { deletedAt: null, billingPlanId: { not: null } },
      select: {
        billingPlan: { select: { minMonthlyFee: true, pricePerEmployee: true } },
        _count: { select: { employees: true } },
      },
    });

    const estimatedMRR = subscriptionsWithPlans.reduce((sum, company) => {
      const plan = company.billingPlan;
      if (!plan) return sum;
      if (plan.minMonthlyFee > 0) return sum + plan.minMonthlyFee;
      return sum + (plan.pricePerEmployee ?? 0) * company._count.employees;
    }, 0);

    return {
      // Core metrics
      totalCompanies,
      activeCompanies,
      trialCompanies: trialCount,
      expiredCompanies: expiredCount,
      suspendedCompanies: suspendedCount,

      // Employee metrics
      totalEmployees: employeeCount,
      activeEmployees: activeEmployeeCount,

      // User metrics
      totalActiveUsers: userStats._count.id,
      usersLoggedInToday,

      // Growth metrics
      newCompaniesThisWeek,

      // Revenue metrics
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyGrossPayroll: Math.round(monthlyGross),
      estimatedMRR: Math.round(estimatedMRR),
      estimatedARR: Math.round(estimatedMRR * 12),

      // Top companies
      topCompaniesByEmployees: topCompaniesByEmployees.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        plan: c.subscriptionPlan,
        employeeCount: c._count.employees,
      })),

      topCompaniesByUsers: topCompaniesByUsers.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        userCount: c._count.users,
      })),

      // Activity feeds
      latestRegistrations: latestCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        plan: c.subscriptionPlan,
        employeeCount: c._count.employees,
        ownerEmail: c.users[0]?.email ?? null,
        ownerLastLogin: c.users[0]?.lastLoginAt ?? null,
        createdAt: c.createdAt,
      })),

      latestPayments: latestPayslips.map((p) => ({
        id: p.id,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
        employeeCode: p.employee.employeeCode,
        companyName: p.employee.company?.name ?? '—',
        netPay: p.netPay,
        grossPay: p.grossPay,
        paidAt: p.paidAt,
      })),

      latestAuditLogs: latestAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        userEmail: log.user?.email ?? null,
        actor: log.user?.employee
          ? `${log.user.employee.firstName} ${log.user.employee.lastName}`
          : null,
        createdAt: log.createdAt,
      })),
    };
  }
}
