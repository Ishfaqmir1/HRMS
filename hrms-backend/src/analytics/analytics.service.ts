import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(companyId: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [
      attendanceToday,
      departmentStrength,
      leaveTrend,
      salaryDistribution,
      genderRatio,
      newJoiners,
      attrition,
    ] = await Promise.all([
      this.getPresentVsAbsent(companyId),
      this.getDepartmentStrength(companyId),
      this.getLeaveTrend(companyId, currentYear),
      this.getSalaryDistribution(companyId),
      this.getGenderRatio(companyId),
      this.getNewJoiners(companyId, currentYear),
      this.getAttrition(companyId, currentYear),
    ]);

    // Summary stats for the top of the dashboard
    const totalEmployees = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } },
    });
    const activeEmployees = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
    });
    const departmentsTotal = await this.prisma.department.count({
      where: { companyId, isActive: true },
    });
    const openPositions = await this.prisma.jobPosting.count({
      where: { companyId, status: 'PUBLISHED' },
    });

    return {
      summary: { totalEmployees, activeEmployees, departmentsTotal, openPositions },
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
  }

  // 1. Present vs Absent — today's attendance distribution
  // Accounts for employees without a record (counted as absent)
  private async getPresentVsAbsent(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [present, onLeave, halfDay, late, activeTotal] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: { companyId, date: today, status: 'PRESENT' } }),
      this.prisma.attendanceRecord.count({ where: { companyId, date: today, status: 'ON_LEAVE' } }),
      this.prisma.attendanceRecord.count({ where: { companyId, date: today, status: 'HALF_DAY' } }),
      this.prisma.attendanceRecord.count({ where: { companyId, date: today, status: 'LATE' } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, status: { in: ['ACTIVE', 'ON_LEAVE'] } } }),
    ]);

    // Employees with a 'PRESENT' record who also have 'ABSENT' as explicit status
    const markedAbsent = await this.prisma.attendanceRecord.count({ where: { companyId, date: today, status: 'ABSENT' } });
    
    // Everyone else who is active but has no record today is absent
    const recorded = present + markedAbsent + onLeave + halfDay + late;
    const absent = Math.max(0, activeTotal - recorded) + markedAbsent;

    return { present, absent, onLeave, halfDay, late };
  }

  // 2. Department strength — active employee count per department (excluding terminated/deleted)
  private async getDepartmentStrength(companyId: string) {
    const departments = await this.prisma.department.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    const result = await Promise.all(
      departments.map(async (d) => {
        const count = await this.prisma.employee.count({
          where: { companyId, departmentId: d.id, deletedAt: null, status: { not: 'TERMINATED' } },
        });
        return { name: d.name, count };
      }),
    );

    return result;
  }

  // 3. Leave trend — monthly leave requests for the year
  private async getLeaveTrend(companyId: string, year: number) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: { companyId, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { createdAt: true, totalDays: true, status: true },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      totalDays: 0,
    }));

    for (const r of requests) {
      const m = new Date(r.createdAt).getMonth();
      monthly[m].total++;
      monthly[m].totalDays += r.totalDays;
      if (r.status === 'APPROVED') monthly[m].approved++;
      else if (r.status === 'PENDING') monthly[m].pending++;
      else if (r.status === 'REJECTED') monthly[m].rejected++;
    }

    return monthly;
  }

  // 4. Salary distribution — by salary range brackets
  private async getSalaryDistribution(companyId: string) {
    const salaries = await this.prisma.employeeSalary.findMany({
      where: { companyId, isActive: true },
      select: {
        basic: true,
        housingAllowance: true,
        transportAllowance: true,
        medicalAllowance: true,
        otherAllowances: true,
        employee: { select: { department: { select: { name: true } } } },
      },
    });

    const brackets = [
      { label: '$0–1K', min: 0, max: 1000, count: 0 },
      { label: '$1K–2K', min: 1000, max: 2000, count: 0 },
      { label: '$2K–3K', min: 2000, max: 3000, count: 0 },
      { label: '$3K–5K', min: 3000, max: 5000, count: 0 },
      { label: '$5K–10K', min: 5000, max: 10000, count: 0 },
      { label: '$10K+', min: 10000, max: Infinity, count: 0 },
    ];

    // Also compute average salary per department
    const deptMap = new Map<string, { total: number; count: number }>();

    for (const s of salaries) {
      const gross = s.basic + s.housingAllowance + s.transportAllowance + s.medicalAllowance + s.otherAllowances;
      for (const b of brackets) {
        if (gross >= b.min && gross < b.max) {
          b.count++;
          break;
        }
      }

      const deptName = s.employee?.department?.name || 'Unassigned';
      if (!deptMap.has(deptName)) deptMap.set(deptName, { total: 0, count: 0 });
      const d = deptMap.get(deptName)!;
      d.total += gross;
      d.count++;
    }

    const byDepartment = Array.from(deptMap.entries()).map(([name, data]) => ({
      name,
      averageSalary: Math.round(data.total / data.count),
      employeeCount: data.count,
    }));

    const totalGross = salaries.reduce((sum, s) => sum + s.basic + s.housingAllowance + s.transportAllowance + s.medicalAllowance + s.otherAllowances, 0);
    const averageSalary = salaries.length > 0 ? Math.round(totalGross / salaries.length) : 0;

    return { brackets, byDepartment, averageSalary, totalEmployees: salaries.length };
  }

  // 5. Gender ratio
  private async getGenderRatio(companyId: string) {
    const [male, female, other, undisclosed] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, deletedAt: null, gender: 'MALE' } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, gender: 'FEMALE' } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, gender: 'OTHER' } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, gender: 'PREFER_NOT_TO_SAY' } }),
    ]);

    return { male, female, other, undisclosed };
  }

  // 6. New joiners — employees joined per month this year
  private async getNewJoiners(companyId: string, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        dateOfJoining: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
      },
      select: { dateOfJoining: true, department: { select: { name: true } } },
      orderBy: { dateOfJoining: 'asc' },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      count: 0,
    }));

    for (const e of employees) {
      const m = new Date(e.dateOfJoining).getMonth();
      monthly[m].count++;
    }

    return monthly;
  }

  // 7. Attrition — employees who left per month this year
  private async getAttrition(companyId: string, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        dateOfExit: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
      },
      select: { dateOfExit: true, status: true },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i).toLocaleString('en', { month: 'short' }),
      resigned: 0,
      terminated: 0,
      total: 0,
    }));

    for (const e of employees) {
      if (!e.dateOfExit) continue;
      const m = new Date(e.dateOfExit).getMonth();
      monthly[m].total++;
      if (e.status === 'RESIGNED') monthly[m].resigned++;
      else if (e.status === 'TERMINATED') monthly[m].terminated++;
    }

    return monthly;
  }
}
