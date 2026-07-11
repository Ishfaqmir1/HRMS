import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
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
    const where = {
      companyId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.departmentId && { employee: { departmentId: filters.departmentId } }),
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
}
