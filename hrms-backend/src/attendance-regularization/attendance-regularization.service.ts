import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegularizationDto, RejectRegularizationDto } from './dto/attendance-regularization.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class AttendanceRegularizationService {
  constructor(private prisma: PrismaService) {}

  /** Employee submits a regularization request for a specific date. */
  async create(companyId: string, employeeId: string, dto: CreateRegularizationDto) {
    const date = this.startOfDay(new Date(dto.date));

    // Verify the employee belongs to this company
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found in this company.');

    // Check if there's already a pending request for this date
    const existing = await this.prisma.attendanceRegularization.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (existing?.status === 'PENDING') {
      throw new BadRequestException('You already have a pending regularization request for this date.');
    }

    // If attendanceId was provided, verify it exists and belongs to the employee
    if (dto.attendanceId) {
      const record = await this.prisma.attendanceRecord.findFirst({
        where: { id: dto.attendanceId, employeeId },
      });
      if (!record) throw new NotFoundException('Attendance record not found.');
    }

    const requestedCheckIn = dto.requestedCheckIn ? new Date(dto.requestedCheckIn) : undefined;
    const requestedCheckOut = dto.requestedCheckOut ? new Date(dto.requestedCheckOut) : undefined;

    // If existing, update to PENDING again (resubmit)
    if (existing) {
      return this.prisma.attendanceRegularization.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          reason: dto.reason,
          attendanceId: dto.attendanceId ?? existing.attendanceId,
          requestedCheckIn: requestedCheckIn ?? existing.requestedCheckIn,
          requestedCheckOut: requestedCheckOut ?? existing.requestedCheckOut,
          requestedStatus: (dto.requestedStatus ?? existing.requestedStatus) as any,
          notes: dto.notes ?? existing.notes,
        },
      });
    }

    return this.prisma.attendanceRegularization.create({
      data: {
        companyId,
        employeeId,
        date,
        attendanceId: dto.attendanceId,
        reason: dto.reason,
        requestedCheckIn,
        requestedCheckOut,
        requestedStatus: dto.requestedStatus as any,
        notes: dto.notes,
      },
    });
  }

  /** Employee's own regularization requests. */
  async myRequests(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRegularization.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.attendanceRegularization.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /** HR: list all regularization requests, optionally filtered. */
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
      this.prisma.attendanceRegularization.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
          attendance: {
            select: { id: true, checkIn: true, checkOut: true, status: true, source: true, date: true },
          },
        },
      }),
      this.prisma.attendanceRegularization.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /** Get a single regularization request (HR view with full details). */
  async findOne(companyId: string, id: string) {
    const request = await this.prisma.attendanceRegularization.findFirst({
      where: { id, companyId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        attendance: {
          select: { id: true, checkIn: true, checkOut: true, status: true, source: true, date: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!request) throw new NotFoundException('Regularization request not found.');
    return request;
  }

  /** HR approves a regularization request and updates the attendance record. */
  async approve(companyId: string, id: string, approverEmployeeId?: string) {
    const request = await this.getPendingRequest(companyId, id);

    return this.prisma.$transaction(async (tx) => {
      // Update the regularization request status
      const updated = await tx.attendanceRegularization.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: approverEmployeeId,
          approvedAt: new Date(),
        },
      });

      // Find or create the attendance record for that date
      const date = request.date;
      const existingRecord = await tx.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: request.employeeId, date } },
      });

      const checkIn = request.requestedCheckIn ?? existingRecord?.checkIn;
      const checkOut = request.requestedCheckOut ?? existingRecord?.checkOut;
      const workedMinutes =
        checkIn && checkOut
          ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
          : existingRecord?.workedMinutes;

      const status = (request.requestedStatus ?? existingRecord?.status ?? 'PRESENT') as any;

      if (existingRecord) {
        await tx.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            checkIn: checkIn ?? existingRecord.checkIn,
            checkOut: checkOut ?? existingRecord.checkOut,
            workedMinutes: workedMinutes ?? existingRecord.workedMinutes,
            status,
            notes: request.notes
              ? `${existingRecord.notes ? existingRecord.notes + ' | ' : ''}Regularized: ${request.reason}`
              : existingRecord.notes,
          },
        });
      } else {
        await tx.attendanceRecord.create({
          data: {
            companyId,
            employeeId: request.employeeId,
            date,
            checkIn: checkIn ?? undefined,
            checkOut: checkOut ?? undefined,
            workedMinutes: workedMinutes ?? undefined,
            status,
            source: 'MANUAL',
            notes: `Regularized: ${request.reason}`,
          },
        });
      }

      return updated;
    });
  }

  /** HR rejects a regularization request. */
  async reject(companyId: string, id: string, dto: RejectRegularizationDto, approverEmployeeId?: string) {
    await this.getPendingRequest(companyId, id);
    return this.prisma.attendanceRegularization.update({
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
    const request = await this.prisma.attendanceRegularization.findFirst({
      where: { id, companyId },
    });
    if (!request) throw new NotFoundException('Regularization request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('This request has already been processed.');
    }
    return request;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
