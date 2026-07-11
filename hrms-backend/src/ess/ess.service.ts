import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leave/leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AttendanceRegularizationService } from '../attendance-regularization/attendance-regularization.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateRegularizationDto } from '../attendance-regularization/dto/attendance-regularization.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EssService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private holidaysService: HolidaysService,
    private regularizationService: AttendanceRegularizationService,
  ) {}

  // ---- Profile ----

  async getProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      if (user.roles.includes('super-admin')) {
        return {
          id: user.userId,
          firstName: 'Super',
          lastName: 'Admin',
          workEmail: user.email,
          department: null,
          branch: null,
          designation: null,
          shift: null,
          reportingManager: null,
          team: null,
        };
      }

      throw new ForbiddenException('This account is not linked to an employee profile.');
    }

    const employeeId = user.employeeId;
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, city: true } },
        designation: { select: { id: true, title: true } },
        shift: true,
        reportingManager: { select: { id: true, firstName: true, lastName: true, workEmail: true } },
        team: { select: { id: true, name: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');
    return employee;
  }

  async updateProfile(employeeId: string, dto: UpdateMyProfileDto) {
    return this.prisma.employee.update({ where: { id: employeeId }, data: dto });
  }

  // ---- Dashboard ----

  async getDashboard(companyId: string, user: AuthenticatedUser) {
    if (!user.employeeId) {
      if (user.roles.includes('super-admin')) {
        return {
          profile: {
            id: user.userId,
            name: 'Super Admin',
            designation: 'Platform Administrator',
            department: null,
            shift: null,
          },
          attendanceToday: null,
          leaveBalances: [],
          pendingLeaveRequests: 0,
          upcomingHolidays: [],
        };
      }

      throw new ForbiddenException('This account is not linked to an employee profile.');
    }

    const employeeId = user.employeeId;
    const [profile, todayAttendance, leaveBalances, upcomingHolidays, pendingLeaveRequests] = await Promise.all([
      this.getProfile(user),
      this.attendanceService.myToday(employeeId),
      this.leaveService.myBalances(employeeId),
      this.holidaysService.findAll(companyId, new Date().getFullYear()),
      this.prisma.leaveRequest.count({ where: { employeeId, status: 'PENDING' } }),
    ]);

    const nextHolidays = upcomingHolidays.filter((h) => h.date >= new Date()).slice(0, 5);

    return {
      profile: {
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        designation: profile.designation?.title ?? null,
        department: profile.department?.name ?? null,
        shift: profile.shift ? { name: profile.shift.name, startTime: profile.shift.startTime, endTime: profile.shift.endTime } : null,
      },
      attendanceToday: todayAttendance,
      leaveBalances,
      pendingLeaveRequests,
      upcomingHolidays: nextHolidays,
    };
  }

  // ---- Payslips ----

  async myPayslips(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payslip.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { run: { select: { month: true, year: true } } },
      }),
      this.prisma.payslip.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async getPayslip(employeeId: string, id: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, employeeId },
      include: {
        run: { select: { month: true, year: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { title: true } } } },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found.');
    return payslip;
  }

  // ---- Leave ----

  async myLeaveHistory(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { leaveType: true },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async myLeaveBalances(employeeId: string) {
    return this.leaveService.myBalances(employeeId);
  }

  // ---- Attendance Calendar ----

  async myAttendanceCalendar(employeeId: string, year?: number, month?: number) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
      include: {
        photos: {
          select: {
            id: true,
            photoType: true,
            imageUrl: true,
            faceMatchScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        breaks: {
          select: {
            id: true,
            type: true,
            startTime: true,
            endTime: true,
            durationMinutes: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    // Also get holidays for this month
    const holidays = await this.prisma.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, name: true },
    });

    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    return {
      year: y,
      month: m,
      records: records.map((r) => ({
        ...r,
        isHoliday: holidayDates.has(r.date.toISOString().split('T')[0]),
      })),
      holidays,
    };
  }

  // ---- Expenses (Reimbursements) ----

  async myExpenses(employeeId: string) {
    return this.prisma.reimbursement.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
  }

  async createExpense(companyId: string, employeeId: string, dto: CreateExpenseDto) {
    const category = await this.prisma.reimbursementCategory.findFirst({
      where: { id: dto.categoryId, companyId },
    });
    if (!category) throw new NotFoundException('Category not found.');

    return this.prisma.reimbursement.create({
      data: {
        companyId,
        employeeId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  // ---- Loans ----

  async myLoans(employeeId: string) {
    return this.prisma.loan.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { repayments: { orderBy: { dueDate: 'asc' } } },
    });
  }

  // ---- Documents ----

  async myDocuments(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.employeeDocument.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // ---- Tax Declarations ----

  async myTaxDeclarations(employeeId: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Attendance Regularization ----

  async myRegularizations(employeeId: string, query: PaginationQueryDto) {
    return this.regularizationService.myRequests(employeeId, query);
  }

  async createRegularization(companyId: string, employeeId: string, dto: CreateRegularizationDto) {
    return this.regularizationService.create(companyId, employeeId, dto);
  }

  // ---- Assets ----

  async myAssets(employeeId: string) {
    return this.prisma.assetAssignment.findMany({
      where: { employeeId },
      include: { asset: true },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ---- Training ----

  async myTraining(employeeId: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { employeeId },
      include: { training: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
