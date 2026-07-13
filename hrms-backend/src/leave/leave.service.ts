import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { CreateLeaveRequestDto, RejectLeaveRequestDto, SetLeaveBalanceDto } from './dto/leave-request.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * Count leave days between two dates using the sandwich rule:
 * 1. Count working days (per company AttendancePolicy)
 * 2. Exclude holidays from the count
 * 3. Non-working days (weekends) that are sandwiched between leave days
 *    are also counted (prevents stretching leave around weekends)
 */
async function calculateLeaveDays(
  prisma: PrismaService,
  companyId: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  // Get company's working days from attendance policy (default Mon-Fri = [1,2,3,4,5])
  const policy = await prisma.attendancePolicy.findUnique({ where: { companyId } });
  const workingDays: number[] = policy?.workingDays ?? [1, 2, 3, 4, 5];

  // Get holidays in the date range
  const holidays = await prisma.holiday.findMany({
    where: { companyId, date: { gte: startDate, lte: endDate } },
    select: { date: true },
  });
  const holidayDates = new Set<string>();
  for (const h of holidays) {
    holidayDates.add(h.date.toISOString().split('T')[0]);
  }

  // Build array of dates in range
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const isWorkingDay = (d: Date) => workingDays.includes(d.getDay());
  const isHolidayDate = (d: Date) => holidayDates.has(d.toISOString().split('T')[0]);
  const isLeaveDay = (d: Date) => isWorkingDay(d) && !isHolidayDate(d);

  // Step 1: Count working days that are not holidays
  let totalDays = 0;
  const leaveDayIndices: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (isLeaveDay(dates[i])) {
      totalDays++;
      leaveDayIndices.push(i);
    }
  }

  // Step 2: Sandwich rule — count non-working days sandwiched between leave days
  for (let i = 0; i < dates.length; i++) {
    if (!isLeaveDay(dates[i])) {
      const hasWorkingBefore = dates.slice(0, i).some(d => isLeaveDay(d));
      const hasWorkingAfter = dates.slice(i + 1).some(d => isLeaveDay(d));
      if (hasWorkingBefore && hasWorkingAfter) {
        totalDays++;
      }
    }
  }

  return Math.max(totalDays, 1); // At minimum 1 day
}

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  // ---- Balances ----

  async myBalances(employeeId: string, year: number = new Date().getFullYear()) {
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      select: {
        id: true,
        allocated: true,
        used: true,
        carriedForward: true,
        leaveType: { select: { id: true, name: true, code: true, isPaid: true, requiresApproval: true } },
      },
    });
  }

  async setBalance(companyId: string, dto: SetLeaveBalanceDto) {
    // Verify employee exists — use select to only check existence
    const employeeExists = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
      select: { id: true },
    });
    if (!employeeExists) throw new NotFoundException('Employee not found in this company.');

    return this.prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
        },
      },
      update: { allocated: dto.allocated, carriedForward: dto.carriedForward ?? 0 },
      create: {
        companyId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        allocated: dto.allocated,
        carriedForward: dto.carriedForward ?? 0,
      },
    });
  }

  // ---- Requests ----

  async createRequest(companyId: string, employeeId: string, dto: CreateLeaveRequestDto) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, companyId, isActive: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found.');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate.');
    }
    const totalDays = await calculateLeaveDays(this.prisma, companyId, startDate, endDate);

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
      },
    });
    if (overlapping) {
      throw new ConflictException('You already have a leave request overlapping these dates.');
    }

    if (leaveType.isPaid) {
      const year = startDate.getFullYear();
      const balance = await this.prisma.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year } },
      });
      const available = (balance?.allocated ?? 0) + (balance?.carriedForward ?? 0) - (balance?.used ?? 0);
      if (available < totalDays) {
        throw new BadRequestException(
          `Insufficient leave balance: ${available} day(s) available, ${totalDays} requested.`,
        );
      }
    }

    // Invalidate dashboard cache for this employee (pending count changes)
    this.cache.delPattern(`dashboard:${companyId}:${employeeId}*`).catch(() => {});

    return this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        status: leaveType.requiresApproval ? 'PENDING' : 'APPROVED',
        approvedAt: leaveType.requiresApproval ? undefined : new Date(),
      },
    });
  }

  async myRequests(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          totalDays: true,
          reason: true,
          status: true,
          createdAt: true,
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async cancelMyRequest(employeeId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, employeeId },
      select: { id: true, status: true, companyId: true, employeeId: true },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    const result = await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    this.cache.delPattern(`dashboard:${request.companyId}:${employeeId}*`).catch(() => {});
    return result;
  }

  async findAll(
    companyId: string,
    query: PaginationQueryDto,
    filters: { employeeId?: string; status?: string } = {},
  ) {
    const where = {
      companyId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.status && { status: filters.status as any }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          leaveType: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async approve(companyId: string, id: string, approverEmployeeId?: string) {
    const request = await this.getPendingRequest(companyId, id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: approverEmployeeId, approvedAt: new Date() },
      });

      if (request.leaveType.isPaid) {
        const year = request.startDate.getFullYear();
        // Prevent negative leave balance before incrementing
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
          },
        });
        if (balance) {
          const available = (balance.allocated ?? 0) + (balance.carriedForward ?? 0) - (balance.used ?? 0);
          if (available < request.totalDays) {
            throw new BadRequestException(
              `Cannot approve: insufficient balance. ${available} day(s) available, ${request.totalDays} requested.`,
            );
          }
        } else {
          // No balance record exists — cannot approve paid leave without allocation
          throw new BadRequestException(
            `Cannot approve: no leave balance allocated for this leave type in ${year}.`,
          );
        }
        await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
          },
          update: { used: { increment: request.totalDays } },
          create: {
            companyId,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
            allocated: 0,
            used: request.totalDays,
          },
        });
      }

      return updated;
    });

    // Invalidate dashboard cache for the employee
    this.cache.delPattern(`dashboard:${companyId}:${request.employeeId}*`).catch(() => {});

    return result;
  }

  async reject(companyId: string, id: string, dto: RejectLeaveRequestDto, approverEmployeeId?: string) {
    const request = await this.getPendingRequest(companyId, id);
    const result = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.rejectionReason,
        approvedById: approverEmployeeId,
        approvedAt: new Date(),
      },
    });
    // Invalidate dashboard cache for the employee (pending count changes)
    this.cache.delPattern(`dashboard:${companyId}:${request.employeeId}*`).catch(() => {});
    return result;
  }

  private async getPendingRequest(companyId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        startDate: true,
        totalDays: true,
        employeeId: true,
        leaveTypeId: true,
        status: true,
        leaveType: { select: { id: true, isPaid: true, requiresApproval: true } },
      },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been processed.');
    }
    return request;
  }
}
