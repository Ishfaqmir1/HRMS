import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { GeoFenceService } from '../geo-fence/geo-fence.service';
import { AttendanceSecurityService } from '../attendance-security/attendance-security.service';
import { AttendancePolicyService } from '../attendance-policy/attendance-policy.service';
import {
  ClockInDto,
  ClockOutDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  StartBreakDto,
  EndBreakDto,
  AttendanceTrendQueryDto,
  DepartmentSummaryQueryDto,
  AttendanceCsvQueryDto,
} from './dto/attendance.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfNextDay(date: Date): Date {
  const d = startOfDay(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function minutesSinceMidnight(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Escape a string value for safe CSV output (double-quote wrapping and escaping). */
function escapeCsv(val: string): string {
  if (val === '') return '';
  // If the value contains commas, quotes, or newlines, wrap in double quotes and escape inner quotes
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
    private geoFenceService: GeoFenceService,
    private securityService: AttendanceSecurityService,
    private policyService: AttendancePolicyService,
  ) {}

  /**
   * Applies attendance policy rules to determine late minutes, status adjustments,
   * and other computed fields based on clock-in time vs shift schedule.
   */
  /**
   * Converts a UTC Date to minutes-since-midnight in a given timezone offset.
   * Falls back to UTC if no offset is provided.
   */
  private toLocalMinutes(date: Date, timezoneOffsetMinutes?: number): number {
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    if (timezoneOffsetMinutes == null) return utcMinutes;
    // Apply timezone offset: local = UTC + offset
    const localMinutes = utcMinutes + timezoneOffsetMinutes;
    // Clamp to 0-1440 (handles UTC day-rollover across midnight)
    return ((localMinutes % 1440) + 1440) % 1440;
  }

  private async applyPolicyEngine(
    companyId: string,
    employeeId: string,
    checkInTime: Date,
  ): Promise<{ lateMinutes: number; status: string }> {
    const policy = await this.policyService.getOrCreatePolicy(companyId);
    let lateMinutes = 0;
    let status = 'PRESENT';

    if (policy.enableAutoLateDetection) {
      // Get employee's shift + branch to determine expected start time & timezone
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: { shift: true, branch: { select: { timezone: true } } },
      });

      // Determine timezone offset from branch (simplified: UTC offset in minutes)
      // In production, use a library like moment-timezone for proper DST-aware conversion.
      // Here we parse a simplified "UTC±HH:MM" offset from the branch timezone string.
      let tzOffsetMinutes: number | undefined;
      const branchTz = employee?.branch?.timezone;
      if (branchTz) {
        const match = branchTz.match(/UTC([+-])(\d{2}):?(\d{2})?/);
        if (match) {
          const sign = match[1] === '+' ? 1 : -1;
          const hours = parseInt(match[2], 10);
          const mins = parseInt(match[3] || '0', 10);
          tzOffsetMinutes = sign * (hours * 60 + mins);
        }
      }

      const startTime = employee?.shift?.startTime || policy.defaultStartTime;
      const expectedStartMinutes = parseTimeToMinutes(startTime);
      const actualMinutes = this.toLocalMinutes(checkInTime, tzOffsetMinutes);

      const diff = actualMinutes - expectedStartMinutes;
      lateMinutes = Math.max(0, diff - policy.gracePeriodMinutes);

      if (lateMinutes > 0) {
        status = 'LATE';
      }
    }

    return { lateMinutes, status };
  }

  /**
   * Applies policy rules on clock-out: half-day detection, overtime, early exit.
   */
  private async applyClockOutPolicy(
    companyId: string,
    employeeId: string,
    checkInTime: Date,
    checkOutTime: Date,
    currentStatus: string,
  ): Promise<{
    status: string;
    overtimeMinutes: number;
    earlyExitMinutes: number;
  }> {
    const policy = await this.policyService.getOrCreatePolicy(companyId);
    let status = currentStatus;
    let overtimeMinutes = 0;
    let earlyExitMinutes = 0;

    const workedMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

    // Half-day detection
    if (policy.enableAutoHalfDay && workedMinutes < policy.halfDayThresholdMinutes) {
      if (status !== 'LATE') status = 'HALF_DAY';
    }

    // Overtime calculation
    if (policy.enableOvertime && workedMinutes > policy.overtimeStartsAfterMinutes) {
      overtimeMinutes = Math.min(
        workedMinutes - policy.overtimeStartsAfterMinutes,
        policy.maxOvertimeMinutes,
      );
    }

    // Early exit detection
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { shift: true },
    });
    const endTime = employee?.shift?.endTime || policy.defaultEndTime;
    const expectedEndMinutes = parseTimeToMinutes(endTime);
    const actualEndMinutes = minutesSinceMidnight(checkOutTime);
    const earlyExit = expectedEndMinutes - actualEndMinutes - policy.gracePeriodMinutes;
    if (earlyExit > 0 && currentStatus === 'PRESENT') {
      earlyExitMinutes = earlyExit;
    }

    return { status, overtimeMinutes, earlyExitMinutes };
  }

  async clockIn(companyId: string, employeeId: string, dto: ClockInDto) {
    const now = new Date();
    const today = startOfDay(now);
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    const policy = await this.policyService.getOrCreatePolicy(companyId);

    if (existing?.checkIn && !policy.enableMultiplePunch) {
      throw new BadRequestException('You have already clocked in today.');
    }

    // ==================================================================
    // Attendance Security — Run all enabled layers (Layers 1–16)
    // ==================================================================
    const securityResult = await this.securityService.verifyAttendanceAction(
      companyId,
      employeeId,
      'CLOCK_IN',
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        browserInfo: dto.browserInfo,
        wifiSsid: dto.wifiSsid,
        wifiBssid: dto.wifiBssid,
        ipAddress: dto.ipAddress,
        qrCode: dto.qrCode,
        faceEncoding: dto.faceEncoding,
        livenessResult: dto.livenessResult,
        lat: dto.lat,
        lng: dto.lng,
        locationAccuracy: dto.locationAccuracy,
        vpnDetected: dto.vpnDetected,
        networkChanged: dto.networkChanged,
        photoUrl: dto.photoUrl,
      },
    );

    if (!securityResult.allowed && securityResult.strictMode) {
      throw new ForbiddenException(securityResult.summary);
    }

    // Layer 4: Geo-fence validation — if lat/lng provided, check against employee's branch
    if (dto.lat != null && dto.lng != null) {
      const fenceResult = await this.geoFenceService.validateAttendanceLocation(
        companyId,
        employeeId,
        { latitude: dto.lat, longitude: dto.lng },
      );

      if (!fenceResult.withinFence) {
        await this.securityService.logSecurityEvent(companyId, employeeId, {
          action: 'CLOCK_IN',
          status: 'DENIED',
          latitude: dto.lat,
          longitude: dto.lng,
          failureReason: `Geo-fence violation: ${fenceResult.distanceMeters}m from branch "${fenceResult.branchName}" (max ${fenceResult.fenceRadiusMeters}m)`,
          layerResults: { geoFence: fenceResult },
        });

        throw new ForbiddenException(
          `You are ${fenceResult.distanceMeters}m away from your branch "${fenceResult.branchName}" ` +
          `(max allowed: ${fenceResult.fenceRadiusMeters}m). Please move closer to clock in.`,
        );
      }
    }

    const source = this.determineSource(dto);

    // ── Apply Policy Engine ──────────────────────────────────────
    const { lateMinutes, status } = await this.applyPolicyEngine(
      companyId, employeeId, now,
    );

    if (lateMinutes > 0) {
      this.logger.log(`Employee ${employeeId} is ${lateMinutes}min late (auto-detected)`);
    }

    const data = {
      checkIn: now,
      source: source as AttendanceSource,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      notes: dto.notes,
      status: status as any,
      lateMinutes,
    };

    let record;
    if (existing) {
      record = await this.prisma.attendanceRecord.update({ where: { id: existing.id }, data });
    } else {
      record = await this.prisma.attendanceRecord.create({
        data: { companyId, employeeId, date: today, ...data },
      });
    }

    // Save attendance photo if provided (Layer 15)
    if (dto.photoUrl) {
      await this.prisma.attendancePhoto.create({
        data: {
          companyId,
          employeeId,
          recordId: record.id,
          photoType: 'CHECK_IN',
          imageUrl: dto.photoUrl,
          faceMatchScore: securityResult.layers.find(l => l.layer === 8)?.details?.score ?? null,
        },
      });
    }

    // Invalidate dashboard cache for this employee
    this.cache.delPattern(`dashboard:${companyId}:${employeeId}*`).catch(() => {});

    // Log successful clock-in
    await this.securityService.logSecurityEvent(companyId, employeeId, {
      action: 'CLOCK_IN',
      status: securityResult.allowed ? 'ALLOWED' : 'FLAGGED',
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      userAgent: dto.browserInfo,
      ipAddress: dto.ipAddress,
      latitude: dto.lat,
      longitude: dto.lng,
      accuracy: dto.locationAccuracy,
      layerResults: { summary: securityResult },
      metadata: { attendanceRecordId: record.id, source, lateMinutes, autoStatus: status },
    });

    return record;
  }

  async clockOut(companyId: string, employeeId: string, dto: ClockOutDto) {
    const now = new Date();
    const today = startOfDay(now);

    let existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!existing?.checkIn) {
      const yesterday = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      existing = await this.prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: yesterday } },
      });
    }

    if (!existing?.checkIn) {
      throw new BadRequestException('You must clock in before clocking out.');
    }
    if (existing.checkOut) {
      throw new BadRequestException('You have already clocked out today.');
    }

    // ==================================================================
    // Run security verification for clock-out (Layers 1–16)
    // ==================================================================
    const securityResult = await this.securityService.verifyAttendanceAction(
      companyId,
      employeeId,
      'CLOCK_OUT',
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        browserInfo: dto.browserInfo,
        wifiSsid: dto.wifiSsid,
        wifiBssid: dto.wifiBssid,
        ipAddress: dto.ipAddress,
        faceEncoding: dto.faceEncoding,
        livenessResult: dto.livenessResult,
        lat: dto.lat,
        lng: dto.lng,
        locationAccuracy: dto.locationAccuracy,
        vpnDetected: dto.vpnDetected,
        networkChanged: dto.networkChanged,
        photoUrl: dto.photoUrl,
      },
    );

    if (!securityResult.allowed && securityResult.strictMode) {
      throw new ForbiddenException(securityResult.summary);
    }

    const checkOut = new Date();
    const rawWorkedMinutes = Math.round((checkOut.getTime() - existing.checkIn.getTime()) / 60000);

    // ── Apply Clock-Out Policy Engine ────────────────────────────
    const { status, overtimeMinutes, earlyExitMinutes } = await this.applyClockOutPolicy(
      companyId,
      employeeId,
      existing.checkIn!,
      checkOut,
      existing.status,
    );

    // Calculate final worked minutes (minus any break time)
    const breakMinutes = existing.breakMinutes || 0;
    const workedMinutes = Math.max(0, rawWorkedMinutes - breakMinutes);

    const record = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOut,
        workedMinutes,
        overtimeMinutes,
        earlyExitMinutes,
        status: status as any,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        notes: dto.notes ?? existing.notes,
      },
    });

    // Save attendance photo if provided (Layer 15)
    if (dto.photoUrl) {
      await this.prisma.attendancePhoto.create({
        data: {
          companyId,
          employeeId,
          recordId: record.id,
          photoType: 'CHECK_OUT',
          imageUrl: dto.photoUrl,
          faceMatchScore: securityResult.layers.find(l => l.layer === 8)?.details?.score ?? null,
        },
      });
    }

    // Invalidate dashboard cache for this employee
    this.cache.delPattern(`dashboard:${companyId}:${employeeId}*`).catch(() => {});

    await this.securityService.logSecurityEvent(companyId, employeeId, {
      action: 'CLOCK_OUT',
      status: securityResult.allowed ? 'ALLOWED' : 'FLAGGED',
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      userAgent: dto.browserInfo,
      ipAddress: dto.ipAddress,
      latitude: dto.lat,
      longitude: dto.lng,
      accuracy: dto.locationAccuracy,
      layerResults: { summary: securityResult },
      metadata: { attendanceRecordId: record.id, workedMinutes, overtimeMinutes, autoStatus: status },
    });

    return record;
  }

  // ==================================================================
  // Break Tracking
  // ==================================================================

  async startBreak(companyId: string, employeeId: string, dto: StartBreakDto) {
    const today = startOfDay(new Date());
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!record?.checkIn) {
      throw new BadRequestException('You must clock in before starting a break.');
    }
    if (record.checkOut) {
      throw new BadRequestException('You have already clocked out today.');
    }

    // Check no active break
    const activeBreak = await this.prisma.attendanceBreak.findFirst({
      where: { recordId: record.id, endTime: null },
    });
    if (activeBreak) {
      throw new BadRequestException('You already have an active break. End it first.');
    }

    const breakRecord = await this.prisma.attendanceBreak.create({
      data: {
        companyId,
        employeeId,
        recordId: record.id,
        type: 'BREAK',
        startTime: new Date(),
      },
    });

    // Store the notes on the attendance record if provided
    if (dto.notes) {
      await this.prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { notes: dto.notes },
      });
    }

    // Update record's break start
    await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { breakStart: breakRecord.startTime },
    });

    return breakRecord;
  }

  async endBreak(companyId: string, employeeId: string, dto: EndBreakDto) {
    const today = startOfDay(new Date());
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!record?.checkIn) {
      throw new BadRequestException('You must clock in before ending a break.');
    }

    const activeBreak = await this.prisma.attendanceBreak.findFirst({
      where: { recordId: record.id, endTime: null },
    });
    if (!activeBreak) {
      throw new BadRequestException('No active break found.');
    }

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - activeBreak.startTime.getTime()) / 60000);

    await this.prisma.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: { endTime, durationMinutes },
    });

    // Update record's break end and total break minutes
    const totalBreakMinutes = (record.breakMinutes || 0) + durationMinutes;
    await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { breakEnd: endTime, breakMinutes: totalBreakMinutes },
    });

    return { message: 'Break ended', durationMinutes, totalBreakMinutes };
  }

  async getBreaks(employeeId: string, recordId: string) {
    return this.prisma.attendanceBreak.findMany({
      where: { employeeId, recordId },
      orderBy: { startTime: 'asc' },
    });
  }

  /** Determines the attendance source based on which security layers were used. */
  private determineSource(dto: ClockInDto | ClockOutDto): string {
    if (dto.qrCode) return 'QR';
    if (dto.faceEncoding && dto.faceEncoding.length > 0) return 'FACE';
    if (dto.lat != null && dto.lng != null) return 'GPS';
    if (dto.deviceId) return 'MOBILE';
    return dto.source || 'WEB';
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
    const employeeFilter: any = { deletedAt: null };
    if (filters.departmentId) {
      employeeFilter.departmentId = filters.departmentId;
    }

    const where = {
      companyId,
      employee: employeeFilter,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...((filters.from || filters.to) && {
        date: {
          ...(filters.from && { gte: startOfDay(new Date(filters.from)) }),
          ...(filters.to && { lt: startOfNextDay(new Date(filters.to)) }),
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

  // ==================================================================
  // Attendance Analytics & Reports
  // ==================================================================

  /**
   * Attendance trend report — aggregates attendance data by day or month
   * over a given date range, split by status.
   */
  async getTrendReport(
    companyId: string,
    query: AttendanceTrendQueryDto,
  ): Promise<{
    period: { from: string; to: string };
    granularity: 'day' | 'month';
    data: Array<{
      label: string;
      date: string;
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      onLeave: number;
      totalRecords: number;
      avgWorkedMinutes: number;
      totalOvertimeMinutes: number;
    }>;
  }> {
    const fromDate = new Date(query.from + 'T00:00:00.000Z');
    const toDate = new Date(query.to + 'T23:59:59.999Z');
    const granularity = query.granularity ?? 'month';

    // Decide date truncation based on granularity
    const dateTrunc = granularity === 'day' ? 'day' : 'month';

    // Use raw SQL for efficient aggregation at database level
    const whereClause = query.departmentId
      ? `WHERE ar."companyId" = $1 AND ar.date >= $2 AND ar.date <= $3 AND e."departmentId" = $4`
      : `WHERE ar."companyId" = $1 AND ar.date >= $2 AND ar.date <= $3`;

    const params: any[] = [companyId, fromDate, toDate];
    if (query.departmentId) params.push(query.departmentId);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        date_label: string;
        present: bigint;
        absent: bigint;
        late: bigint;
        half_day: bigint;
        on_leave: bigint;
        total_count: bigint;
        avg_worked: number | null;
        overtime_sum: number | null;
      }>
    >(
      `SELECT
        DATE_TRUNC('${dateTrunc}', ar.date)::text AS date_label,
        COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
        COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
        COUNT(*) FILTER (WHERE ar.status = 'LATE')::int AS late,
        COUNT(*) FILTER (WHERE ar.status = 'HALF_DAY')::int AS half_day,
        COUNT(*) FILTER (WHERE ar.status = 'ON_LEAVE')::int AS on_leave,
        COUNT(*)::int AS total_count,
        ROUND(AVG(ar."workedMinutes") FILTER (WHERE ar."workedMinutes" IS NOT NULL))::int AS avg_worked,
        COALESCE(SUM(ar."overtimeMinutes")::int, 0) AS overtime_sum
      FROM attendance_records ar
      LEFT JOIN employees e ON e.id = ar."employeeId"
      ${whereClause}
      GROUP BY date_label
      ORDER BY date_label`,
      ...params,
    );

    const data = rows.map((row) => ({
      label: row.date_label,
      date: row.date_label,
      present: Number(row.present),
      absent: Number(row.absent),
      late: Number(row.late),
      halfDay: Number(row.half_day),
      onLeave: Number(row.on_leave),
      totalRecords: Number(row.total_count),
      avgWorkedMinutes: Math.round(row.avg_worked ?? 0),
      totalOvertimeMinutes: Number(row.overtime_sum ?? 0),
    }));

    return {
      period: { from: query.from, to: query.to },
      granularity,
      data,
    };
  }

  /**
   * Department attendance summary — shows attendance stats grouped by
   * department for a given date range.
   */
  async getDepartmentSummary(
    companyId: string,
    query: DepartmentSummaryQueryDto,
  ): Promise<{
    period: { from: string; to: string };
    departments: Array<{
      departmentId: string | null;
      departmentName: string;
      employeeCount: number;
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      onLeave: number;
      totalAttendanceDays: number;
      avgWorkedMinutes: number;
      attendanceRate: number;
    }>;
  }> {
    const fromDate = new Date(query.from + 'T00:00:00.000Z');
    const toDate = new Date(query.to + 'T23:59:59.999Z');

    // Get all active departments with employee counts
    const departments = await this.prisma.department.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        _count: { select: { employees: { where: { deletedAt: null, status: { not: 'TERMINATED' } } } } },
      },
      orderBy: { name: 'asc' },
    });

    // Also include "Unassigned" employees (those with no department)
    const unassignedCount = await this.prisma.employee.count({
      where: { companyId, departmentId: null, deletedAt: null, status: { not: 'TERMINATED' } },
    });

    // Get attendance aggregation by department using raw SQL
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        dept_id: string | null;
        present: bigint;
        absent: bigint;
        late: bigint;
        half_day: bigint;
        on_leave: bigint;
        total_count: bigint;
        avg_worked: number | null;
      }>
    >(
      `SELECT
        e."departmentId" AS dept_id,
        COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
        COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
        COUNT(*) FILTER (WHERE ar.status = 'LATE')::int AS late,
        COUNT(*) FILTER (WHERE ar.status = 'HALF_DAY')::int AS half_day,
        COUNT(*) FILTER (WHERE ar.status = 'ON_LEAVE')::int AS on_leave,
        COUNT(*)::int AS total_count,
        ROUND(AVG(ar."workedMinutes") FILTER (WHERE ar."workedMinutes" IS NOT NULL))::int AS avg_worked
      FROM attendance_records ar
      INNER JOIN employees e ON e.id = ar."employeeId"
      WHERE ar."companyId" = $1 AND ar.date >= $2 AND ar.date <= $3
      GROUP BY e."departmentId"
      ORDER BY e."departmentId"`,
      companyId,
      fromDate,
      toDate,
    );

    // Build lookup map from dept_id → stats
    const deptStats = new Map<
      string | null,
      { present: number; absent: number; late: number; halfDay: number; onLeave: number; totalCount: number; avgWorked: number }
    >();
    for (const row of rows) {
      deptStats.set(row.dept_id, {
        present: Number(row.present),
        absent: Number(row.absent),
        late: Number(row.late),
        halfDay: Number(row.half_day),
        onLeave: Number(row.on_leave),
        totalCount: Number(row.total_count),
        avgWorked: Math.round(row.avg_worked ?? 0),
      });
    }

    const departmentSummaries: Array<{
      departmentId: string | null;
      departmentName: string;
      employeeCount: number;
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      onLeave: number;
      totalAttendanceDays: number;
      avgWorkedMinutes: number;
      attendanceRate: number;
    }> = departments.map((dept) => {
      const stats = deptStats.get(dept.id) ?? {
        present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0,
        totalCount: 0, avgWorked: 0,
      };
      const attended = stats.present + stats.late + stats.halfDay;
      const totalDays = stats.totalCount || 1;
      const attendanceRate = Math.round((attended / totalDays) * 100);

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        employeeCount: dept._count.employees,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        halfDay: stats.halfDay,
        onLeave: stats.onLeave,
        totalAttendanceDays: stats.totalCount,
        avgWorkedMinutes: stats.avgWorked,
        attendanceRate,
      };
    });

    // Add unassigned employees if any have records
    if (unassignedCount > 0) {
      const unassignedStats = deptStats.get(null) ?? {
        present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0,
        totalCount: 0, avgWorked: 0,
      };
      const attended = unassignedStats.present + unassignedStats.late + unassignedStats.halfDay;
      const totalDays = unassignedStats.totalCount || 1;
      departmentSummaries.push({
        departmentId: null,
        departmentName: 'Unassigned',
        employeeCount: unassignedCount,
        present: unassignedStats.present,
        absent: unassignedStats.absent,
        late: unassignedStats.late,
        halfDay: unassignedStats.halfDay,
        onLeave: unassignedStats.onLeave,
        totalAttendanceDays: unassignedStats.totalCount,
        avgWorkedMinutes: unassignedStats.avgWorked,
        attendanceRate: Math.round((attended / totalDays) * 100),
      });
    }

    return {
      period: { from: query.from, to: query.to },
      departments: departmentSummaries,
    };
  }

  /**
   * Export attendance records as CSV. Returns the CSV content as a string.
   * Controller handles setting response headers for download.
   */
  async exportCsv(
    companyId: string,
    query: AttendanceCsvQueryDto,
  ): Promise<{ csv: string; rowCount: number; truncated: boolean }> {
    const where: any = { companyId };
    const employeeFilter: any = { deletedAt: null };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.departmentId) employeeFilter.departmentId = query.departmentId;
    where.employee = employeeFilter;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from + 'T00:00:00.000Z');
      if (query.to) where.date.lte = new Date(query.to + 'T23:59:59.999Z');
    }

    const MAX_EXPORT_ROWS = 50_000;

    // Fetch records with a max limit to prevent OOM on large exports
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      take: MAX_EXPORT_ROWS + 1, // Fetch one extra to detect truncation
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      include: {
        employee: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });

    const truncated = records.length > MAX_EXPORT_ROWS;
    const exportRows = truncated ? records.slice(0, MAX_EXPORT_ROWS) : records;

    // Build CSV in memory
    const lines: string[] = [];

    const headers = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Department',
      'Designation',
      'Branch',
      'Date',
      'Status',
      'Clock In',
      'Clock Out',
      'Worked Minutes',
      'Overtime Minutes',
      'Late Minutes',
      'Early Exit Minutes',
      'Source',
      'Notes',
    ];
    lines.push(headers.join(','));

    for (const record of exportRows) {
      const row = [
        escapeCsv(record.employee?.employeeCode ?? ''),
        escapeCsv(record.employee?.firstName ?? ''),
        escapeCsv(record.employee?.lastName ?? ''),
        escapeCsv(record.employee?.department?.name ?? ''),
        escapeCsv(record.employee?.designation?.title ?? ''),
        escapeCsv(record.employee?.branch?.name ?? ''),
        record.date.toISOString().slice(0, 10),
        record.status,
        record.checkIn ? record.checkIn.toISOString() : '',
        record.checkOut ? record.checkOut.toISOString() : '',
        record.workedMinutes?.toString() ?? '',
        record.overtimeMinutes?.toString() ?? '',
        record.lateMinutes?.toString() ?? '',
        record.earlyExitMinutes?.toString() ?? '',
        record.source,
        escapeCsv(record.notes ?? ''),
      ];
      lines.push(row.join(','));
    }

    if (truncated) {
      lines.push(`"\n[Export truncated at ${MAX_EXPORT_ROWS} rows. Refine your filters for a smaller export.]"`);
    }

    return { csv: lines.join('\n'), rowCount: exportRows.length, truncated };
  }
}
