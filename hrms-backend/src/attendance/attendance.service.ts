import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoFenceService } from '../geo-fence/geo-fence.service';
import {
  ClockInDto,
  ClockOutDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private geoFenceService: GeoFenceService,
  ) {}

  async clockIn(companyId: string, employeeId: string, dto: ClockInDto) {
    const today = startOfDay(new Date());
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.checkIn) {
      throw new BadRequestException('You have already clocked in today.');
    }

    // Geo-fence validation — if lat/lng provided, check against employee's branch
    if (dto.lat != null && dto.lng != null) {
      const fenceResult = await this.geoFenceService.validateAttendanceLocation(
        companyId,
        employeeId,
        { latitude: dto.lat, longitude: dto.lng },
      );

      if (!fenceResult.withinFence) {
        throw new ForbiddenException(
          `You are ${fenceResult.distanceMeters}m away from your branch "${fenceResult.branchName}" ` +
          `(max allowed: ${fenceResult.fenceRadiusMeters}m). Please move closer to clock in.`,
        );
      }
    }

    const data = {
      checkIn: new Date(),
      source: (dto.source || 'WEB') as AttendanceSource,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      notes: dto.notes,
      status: 'PRESENT' as const,
    };

    if (existing) {
      return this.prisma.attendanceRecord.update({ where: { id: existing.id }, data });
    }

    return this.prisma.attendanceRecord.create({
      data: { companyId, employeeId, date: today, ...data },
    });
  }

  async clockOut(companyId: string, employeeId: string, dto: ClockOutDto) {
    const today = startOfDay(new Date());
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!existing?.checkIn) {
      throw new BadRequestException('You must clock in before clocking out.');
    }
    if (existing.checkOut) {
      throw new BadRequestException('You have already clocked out today.');
    }

    const checkOut = new Date();
    const workedMinutes = Math.round((checkOut.getTime() - existing.checkIn.getTime()) / 60000);

    return this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOut,
        workedMinutes,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        notes: dto.notes ?? existing.notes,
      },
    });
  }

  /** Today's attendance record for the current employee (or null if not yet clocked in). */
  async myToday(employeeId: string) {
    const today = startOfDay(new Date());
    return this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
  }

  async myHistory(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findAll(
    companyId: string,
    query: PaginationQueryDto,
    filters: { employeeId?: string; departmentId?: string; from?: string; to?: string } = {},
  ) {
    const where = {
      companyId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.departmentId && { employee: { departmentId: filters.departmentId } }),
      ...((filters.from || filters.to) && {
        date: {
          ...(filters.from && { gte: startOfDay(new Date(filters.from)) }),
          ...(filters.to && { lte: startOfDay(new Date(filters.to)) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { date: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id, companyId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!record) throw new NotFoundException('Attendance record not found.');
    return record;
  }

  /** HR manual entry — e.g. backfilling attendance for an employee without device access. */
  async createManual(companyId: string, dto: CreateAttendanceDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found in this company.');

    const date = startOfDay(new Date(dto.date));
    const checkIn = dto.checkIn ? new Date(dto.checkIn) : undefined;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : undefined;
    const workedMinutes =
      checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : undefined;

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      update: { checkIn, checkOut, workedMinutes, status: dto.status, notes: dto.notes, source: 'MANUAL' as AttendanceSource },
      create: {
        companyId,
        employeeId: dto.employeeId,
        date,
        checkIn,
        checkOut,
        workedMinutes,
        status: dto.status || 'PRESENT',
        source: 'MANUAL' as AttendanceSource,
        notes: dto.notes,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAttendanceDto) {
    const record = await this.findOne(companyId, id);
    const checkIn = dto.checkIn ? new Date(dto.checkIn) : record.checkIn;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : record.checkOut;
    const workedMinutes =
      checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : record.workedMinutes;

    return this.prisma.attendanceRecord.update({
      where: { id },
      data: { checkIn, checkOut, workedMinutes, status: dto.status, notes: dto.notes },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.attendanceRecord.delete({ where: { id } });
    return { message: 'Attendance record removed.' };
  }
}
