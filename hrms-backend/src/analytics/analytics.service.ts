import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';

const ANALYTICS_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async getDashboard(companyId: string) {
    // Guard: if no companyId (e.g. platform super admin), return empty analytics
    if (!companyId) {
      const now = new Date();
      return {
        summary: { totalEmployees: 0, activeEmployees: 0, departmentsTotal: 0, openPositions: 0 },
        attendanceToday: { present: 0, absent: 0, onLeave: 0, halfDay: 0, late: 0 },
        departmentStrength: [],
        leaveTrend: [],
        salaryDistribution: { brackets: [], byDepartment: [], averageSalary: 0, totalEmployees: 0 },
        genderRatio: { male: 0, female: 0, other: 0, undisclosed: 0 },
        newJoiners: [],
        attrition: [],
        currentYear: now.getFullYear(),
        currentMonth: now.getMonth() + 1,
      };
    }

    const cacheKey = RedisCacheService.key('analytics', 'dashboard', companyId);
    return this.cache.getOrSet(cacheKey, ANALYTICS_CACHE_TTL, async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Batch all top-level queries together
      const [
        attendanceToday,
        departmentStrength,
        leaveTrend,
        salaryDistribution,
        genderRatio,
        newJoiners,
        attrition,
        summaryCounts,
      ] = await Promise.all([
        this.getPresentVsAbsent(companyId),
        this.getDepartmentStrength(companyId),
        this.getLeaveTrend(companyId, currentYear),
        this.getSalaryDistribution(companyId),
        this.getGenderRatio(companyId),
        this.getNewJoiners(companyId, currentYear),
        this.getAttrition(companyId, currentYear),
        // Combine summary counts into one batch
        (async () => {
          const [totalEmployees, activeEmployees, departmentsTotal, openPositions] = await Promise.all([
            this.prisma.employee.count({ where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } } }),
            this.prisma.employee.count({ where: { companyId, deletedAt: null, status: 'ACTIVE' } }),
            this.prisma.department.count({ where: { companyId, isActive: true } }),
            this.prisma.jobPosting.count({ where: { companyId, status: 'PUBLISHED' } }),
          ]);
          return { totalEmployees, activeEmployees, departmentsTotal, openPositions };
        })(),
      ]);

      return {
        summary: summaryCounts,
        attendanceToday,
        departmentStrength,
        leaveTrend,
        salaryDistribution,
        genderRatio,
        newJoiners,
        attrition,
        currentYear,
        currentMonth,
      };
    });
  }

  // 1. Present vs Absent — single groupBy query instead of 6 separate counts
  private async getPresentVsAbsent(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [statusCounts, activeTotal] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { companyId, date: today },
        _count: { _all: true },
      }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, status: { in: ['ACTIVE', 'ON_LEAVE'] } } }),
    ]);

    const counts = {
      PRESENT: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
      HALF_DAY: 0,
      LATE: 0,
    };
    for (const row of statusCounts) {
      counts[row.status as keyof typeof counts] = row._count._all;
    }

    const recorded = counts.PRESENT + counts.ABSENT + counts.ON_LEAVE + counts.HALF_DAY + counts.LATE;
    const absent = Math.max(0, activeTotal - recorded) + counts.ABSENT;

    return { present: counts.PRESENT, absent, onLeave: counts.ON_LEAVE, halfDay: counts.HALF_DAY, late: counts.LATE };
  }

  // 2. Department strength — already optimized (single groupBy)
  private async getDepartmentStrength(companyId: string) {
    const departments = await this.prisma.department.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const counts = await this.prisma.employee.groupBy({
      by: ['departmentId'],
      where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } },
      _count: { _all: true },
    });

    const countByDepartment = new Map(counts.map((row) => [row.departmentId ?? '', row._count._all]));
    return departments.map((department) => ({
      name: department.name,
      count: countByDepartment.get(department.id) ?? 0,
    }));
  }

  // 3. Leave trend — use groupBy for monthly aggregation instead of in-memory loop
  private async getLeaveTrend(companyId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    // Pre-fill all 12 months
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      totalDays: 0,
    }));

    // Get counts by month using SQL-level aggregation
    const monthlyCounts = await this.prisma.leaveRequest.groupBy({
      by: ['status'],
      where: { companyId, createdAt: { gte: startDate, lt: endDate } },
      _count: { _all: true },
      _sum: { totalDays: true },
    });

    // We need per-month breakdown, so fetch minimal data and aggregate in JS
    // This is still better than fetching all records
    const byMonth = await this.prisma.$queryRawUnsafe<Array<{ month: number; status: string; count: bigint; total_days: number | null }>>(
      `SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        status,
        COUNT(*)::int AS count,
        COALESCE(SUM("totalDays"), 0) AS total_days
      FROM leave_requests
      WHERE "companyId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
      GROUP BY month, status
      ORDER BY month`,
      companyId,
      startDate,
      endDate,
    );

    for (const row of byMonth) {
      const idx = row.month - 1;
      if (idx >= 0 && idx < 12) {
        monthly[idx].total += Number(row.count);
        monthly[idx].totalDays += Number(row.total_days ?? 0);
        if (row.status === 'APPROVED') monthly[idx].approved += Number(row.count);
        else if (row.status === 'PENDING') monthly[idx].pending += Number(row.count);
        else if (row.status === 'REJECTED') monthly[idx].rejected += Number(row.count);
      }
    }

    return monthly;
  }

  // 4. Salary distribution — use SQL aggregation instead of fetching all records
  private async getSalaryDistribution(companyId: string) {
    // Use SQL aggregation for average per department
    const deptAverages = await this.prisma.$queryRawUnsafe<Array<{ dept_name: string; avg_salary: number; emp_count: bigint }>>(
      `SELECT
        COALESCE(d.name, 'Unassigned') AS dept_name,
        ROUND(AVG(es.basic + es."housingAllowance" + es."transportAllowance" + es."medicalAllowance" + es."otherAllowances"))::int AS avg_salary,
        COUNT(*)::int AS emp_count
      FROM employee_salaries es
      LEFT JOIN employees e ON e.id = es."employeeId"
      LEFT JOIN departments d ON d.id = e."departmentId"
      WHERE es."companyId" = $1 AND es."isActive" = true
      GROUP BY d.name
      ORDER BY d.name`,
      companyId,
    );

    // Get salary brackets from SQL
    const bracketsRaw = await this.prisma.$queryRawUnsafe<Array<{ bracket: string; count: bigint }>>(
      `SELECT
        CASE
          WHEN gross < 1000 THEN '$0-1K'
          WHEN gross < 2000 THEN '$1K-2K'
          WHEN gross < 3000 THEN '$2K-3K'
          WHEN gross < 5000 THEN '$3K-5K'
          WHEN gross < 10000 THEN '$5K-10K'
          ELSE '$10K+'
        END AS bracket,
        COUNT(*)::int AS count
      FROM (
        SELECT (es.basic + es."housingAllowance" + es."transportAllowance" + es."medicalAllowance" + es."otherAllowances") AS gross
        FROM employee_salaries es
        WHERE es."companyId" = $1 AND es."isActive" = true
      ) sub
      GROUP BY bracket
      ORDER BY MIN(gross)`,
      companyId,
    );

    const bracketLabels = ['$0-1K', '$1K-2K', '$2K-3K', '$3K-5K', '$5K-10K', '$10K+'];
    const bracketCounts = new Map(bracketsRaw.map((r) => [r.bracket, Number(r.count)]));
    const brackets = bracketLabels.map((label) => ({
      label,
      min: 0,
      max: label === '$10K+' ? Infinity : parseInt(label.split('-')[1]?.replace('K', '000') ?? '1000'),
      count: bracketCounts.get(label) ?? 0,
    }));

    const totalSalary = await this.prisma.employeeSalary.aggregate({
      where: { companyId, isActive: true },
      _sum: { basic: true, housingAllowance: true, transportAllowance: true, medicalAllowance: true, otherAllowances: true },
      _count: { id: true },
    });

    const totals = totalSalary._sum;
    const totalGross = (totals.basic ?? 0) + (totals.housingAllowance ?? 0) + (totals.transportAllowance ?? 0) + (totals.medicalAllowance ?? 0) + (totals.otherAllowances ?? 0);
    const totalEmployees = totalSalary._count.id;

    return {
      brackets,
      byDepartment: deptAverages.map((d) => ({
        name: d.dept_name,
        averageSalary: Math.round(d.avg_salary),
        employeeCount: Number(d.emp_count),
      })),
      averageSalary: totalEmployees > 0 ? Math.round(totalGross / totalEmployees) : 0,
      totalEmployees,
    };
  }

  // 5. Gender ratio — single groupBy instead of 4 separate count queries
  private async getGenderRatio(companyId: string) {
    const genderCounts = await this.prisma.employee.groupBy({
      by: ['gender'],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });

    const counts = { MALE: 0, FEMALE: 0, OTHER: 0, PREFER_NOT_TO_SAY: 0 };
    for (const row of genderCounts) {
      if (row.gender) {
        counts[row.gender] = row._count._all;
      }
    }

    return { male: counts.MALE, female: counts.FEMALE, other: counts.OTHER, undisclosed: counts.PREFER_NOT_TO_SAY };
  }

  // 6. New joiners — use SQL-level monthly aggregation
  private async getNewJoiners(companyId: string, year: number) {
    const monthlyRaw = await this.prisma.$queryRawUnsafe<Array<{ month: number; count: bigint }>>(
      `SELECT
        EXTRACT(MONTH FROM "dateOfJoining")::int AS month,
        COUNT(*)::int AS count
      FROM employees
      WHERE "companyId" = $1 AND "deletedAt" IS NULL
        AND "dateOfJoining" >= $2 AND "dateOfJoining" <= $3
      GROUP BY month
      ORDER BY month`,
      companyId,
      new Date(year, 0, 1),
      new Date(year, 11, 31),
    );

    const countByMonth = new Map(monthlyRaw.map((r) => [r.month, Number(r.count)]));
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      count: countByMonth.get(i + 1) ?? 0,
    }));
  }

  // 7. Attrition — use SQL-level monthly aggregation
  private async getAttrition(companyId: string, year: number) {
    const monthlyRaw = await this.prisma.$queryRawUnsafe<Array<{ month: number; status: string; count: bigint }>>(
      `SELECT
        EXTRACT(MONTH FROM "dateOfExit")::int AS month,
        status,
        COUNT(*)::int AS count
      FROM employees
      WHERE "companyId" = $1 AND "dateOfExit" IS NOT NULL
        AND "dateOfExit" >= $2 AND "dateOfExit" <= $3
      GROUP BY month, status
      ORDER BY month`,
      companyId,
      new Date(year, 0, 1),
      new Date(year, 11, 31),
    );

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      resigned: 0,
      terminated: 0,
      total: 0,
    }));

    for (const row of monthlyRaw) {
      const idx = row.month - 1;
      if (idx >= 0 && idx < 12) {
        const count = Number(row.count);
        monthly[idx].total += count;
        if (row.status === 'RESIGNED') monthly[idx].resigned += count;
        else if (row.status === 'TERMINATED') monthly[idx].terminated += count;
      }
    }

    return monthly;
  }
}
