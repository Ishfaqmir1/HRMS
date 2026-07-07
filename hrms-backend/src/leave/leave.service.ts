import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto, RejectLeaveRequestDto, SetLeaveBalanceDto } from './dto/leave-request.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/** Inclusive day count between two dates. Phase 2 keeps this simple (calendar
 *  days); a later phase can subtract weekends/holidays per employee shift. */
function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  // ---- Balances ----

  async myBalances(employeeId: string, year: number = new Date().getFullYear()) {
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    });
  }

  async setBalance(companyId: string, dto: SetLeaveBalanceDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found in this company.');

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
    const totalDays = daysBetweenInclusive(startDate, endDate);

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
        include: { leaveType: true },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async cancelMyRequest(employeeId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, employeeId } });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    return this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
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

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: approverEmployeeId, approvedAt: new Date() },
      });

      if (request.leaveType.isPaid) {
        const year = request.startDate.getFullYear();
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
  }

  async reject(companyId: string, id: string, dto: RejectLeaveRequestDto, approverEmployeeId?: string) {
    await this.getPendingRequest(companyId, id);
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.rejectionReason,
        approvedById: approverEmployeeId,
        approvedAt: new Date(),
      },
    });
  }

  private async getPendingRequest(companyId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId },
      include: { leaveType: true },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been processed.');
    }
    return request;
  }
}
