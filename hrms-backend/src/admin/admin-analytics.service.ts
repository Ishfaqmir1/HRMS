import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // ── Run all aggregations in parallel ──────────────────────
    const [
      totalCompanies,
      totalEmployees,
      activeEmployees,
      companyRegistrationsByMonth,
      employeeGrowthByMonth,
      companiesByPlan,
      companiesByStatus,
      companiesByIndustry,
      payrollSummary,
      topCompanies,
    ] = await Promise.all([
      // Total active companies
      this.prisma.company.count({ where: { deletedAt: null } }),

      // Total employees (non-terminated)
      this.prisma.employee.count({
        where: { deletedAt: null, status: { not: 'TERMINATED' } },
      }),

      // Active employees
      this.prisma.employee.count({
        where: { deletedAt: null, status: 'ACTIVE' },
      }),

      // Company registrations by month this year
      this.prisma.$queryRawUnsafe<Array<{ month: number; count: bigint }>>(
        `SELECT
          EXTRACT(MONTH FROM "createdAt")::int AS month,
          COUNT(*)::int AS count
        FROM companies
        WHERE "deletedAt" IS NULL
          AND "createdAt" >= $1 AND "createdAt" < $2
        GROUP BY month
        ORDER BY month`,
        yearStart,
        new Date(currentYear + 1, 0, 1),
      ),

      // Employee growth by month (new joiners per month this year)
      this.prisma.$queryRawUnsafe<Array<{ month: number; count: bigint }>>(
        `SELECT
          EXTRACT(MONTH FROM "dateOfJoining")::int AS month,
          COUNT(*)::int AS count
        FROM employees
        WHERE "deletedAt" IS NULL
          AND "dateOfJoining" >= $1 AND "dateOfJoining" < $2
        GROUP BY month
        ORDER BY month`,
        yearStart,
        new Date(currentYear + 1, 0, 1),
      ),

      // Companies grouped by subscription plan
      this.prisma.company.groupBy({
        by: ['subscriptionPlan'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // Companies grouped by status
      this.prisma.company.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // Companies grouped by industry
      this.prisma.company.groupBy({
        by: ['industry'],
        where: { deletedAt: null, industry: { not: null } },
        _count: { _all: true },
      }),

      // Payroll summary this month
      this.prisma.payrollRun.aggregate({
        _sum: { totalNet: true, totalGross: true },
        _count: { _all: true },
        where: {
          status: 'COMPLETED',
          processedAt: { gte: monthStart },
        },
      }),

      // Top 5 companies by employee count
      this.prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { employees: { _count: 'desc' } },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionPlan: true,
          _count: { select: { employees: true, users: true } },
        },
      }),
    ]);

    // ── Transform ─────────────────────────────────────────────

    // Company registrations by month — fill missing months
    const regByMonth = new Map(companyRegistrationsByMonth.map((r) => [r.month, Number(r.count)]));
    const registrationsByMonth = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(currentYear, i).toLocaleString('en', { month: 'short' }),
      count: regByMonth.get(i + 1) ?? 0,
    }));

    // Employee growth by month
    const empByMonth = new Map(employeeGrowthByMonth.map((r) => [r.month, Number(r.count)]));
    const employeeGrowth = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(currentYear, i).toLocaleString('en', { month: 'short' }),
      count: empByMonth.get(i + 1) ?? 0,
    }));

    return {
      summary: {
        totalCompanies,
        totalEmployees,
        activeEmployees,
        companiesOnTrial: companiesByPlan.find((p) => p.subscriptionPlan === 'TRIAL')?._count._all ?? 0,
        companiesOnPaid: companiesByPlan.filter((p) => p.subscriptionPlan && p.subscriptionPlan !== 'TRIAL').reduce((sum, p) => sum + p._count._all, 0),
        pendingApprovals: companiesByStatus.find((s) => s.status === 'PENDING_APPROVAL')?._count._all ?? 0,
        suspendedCompanies: companiesByStatus.find((s) => s.status === 'SUSPENDED')?._count._all ?? 0,
      },
      registrationsByMonth,
      employeeGrowth,
      companiesByPlan: companiesByPlan.map((p) => ({
        plan: p.subscriptionPlan ?? 'UNKNOWN',
        count: p._count._all,
      })),
      companiesByStatus: companiesByStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      companiesByIndustry: companiesByIndustry.map((i) => ({
        industry: i.industry ?? 'Unknown',
        count: i._count._all,
      })),
      payrollThisMonth: {
        totalPayrolls: payrollSummary._count._all,
        totalNet: payrollSummary._sum.totalNet ?? 0,
        totalGross: payrollSummary._sum.totalGross ?? 0,
        totalEmployeesPaid: 0,
      },
      topCompanies: topCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        plan: c.subscriptionPlan,
        employeeCount: c._count.employees,
        userCount: c._count.users,
      })),
      currentYear,
      currentMonth,
    };
  }
}
