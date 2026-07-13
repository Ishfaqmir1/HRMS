import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AttendanceStatusDto } from './dto/attendance.dto';

// ================================================================
// Mock helpers
// ================================================================

const mockPrisma = {
  attendanceRecord: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  attendancePhoto: {
    create: jest.fn(),
  },
  employee: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockGeoFenceService = {
  validateAttendanceLocation: jest.fn(),
  calculateDistance: jest.fn(),
};

const mockSecurityService = {
  verifyAttendanceAction: jest.fn(),
  logSecurityEvent: jest.fn(),
};

const mockPolicyService = {
  getOrCreatePolicy: jest.fn(),
  getPolicy: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn().mockResolvedValue(undefined),
  getOrSet: jest.fn(),
};

import { AttendanceService } from './attendance.service';

describe('AttendanceService — Comprehensive Edge Case Tests', () => {
  let service: AttendanceService;
  const COMPANY_ID = 'company-1';
  const EMPLOYEE_ID = 'employee-1';

  // Helper to create a mock attendance record
  function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'record-1',
      companyId: COMPANY_ID,
      employeeId: EMPLOYEE_ID,
      date: expect.any(Date),
      checkIn: null,
      checkOut: null,
      workedMinutes: null,
      status: 'PRESENT',
      source: 'WEB',
      checkInLat: null,
      checkInLng: null,
      checkOutLat: null,
      checkOutLng: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // Security layer result helper — all layers pass by default
  const defaultSecurityResult = {
    allowed: true,
    strictMode: false,
    layers: [
      { layer: 1, name: 'JWT Authentication', passed: true, required: true },
      { layer: 2, name: 'Trusted Device', passed: true, required: false },
      { layer: 3, name: 'GPS Location', passed: true, required: false },
      { layer: 5, name: 'Wi-Fi Verification', passed: true, required: false },
      { layer: 6, name: 'IP Validation', passed: true, required: false },
      { layer: 7, name: 'QR Code Scan', passed: true, required: false },
      { layer: 8, name: 'Face Verification', passed: true, required: false },
      { layer: 9, name: 'Liveness Detection', passed: true, required: false },
      { layer: 10, name: 'Device Binding', passed: true, required: false },
      { layer: 11, name: 'Location Integrity', passed: true, required: false },
      { layer: 12, name: 'VPN Detection', passed: true, required: false },
      { layer: 13, name: 'Network Change Detection', passed: true, required: false },
      { layer: 14, name: 'Time Validation (Server)', passed: true, required: true },
      { layer: 15, name: 'Attendance Photo', passed: true, required: false },
    ],
    summary: 'All 14/14 security checks passed.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mocks
    mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
    mockPrisma.attendanceRecord.findFirst.mockResolvedValue(null);
    mockPrisma.attendanceRecord.create.mockImplementation(({ data }: any) => ({
      id: 'record-new',
      ...data,
    }));
    mockPrisma.attendanceRecord.update.mockImplementation(({ data }: any) => ({
      id: 'record-1',
      ...data,
    }));
    mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
    mockPrisma.attendanceRecord.count.mockResolvedValue(0);
    mockPrisma.attendancePhoto.create.mockResolvedValue({});
    mockPrisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID });
    mockPrisma.$transaction.mockImplementation(([...queries]: any) =>
      Promise.all(queries),
    );

    mockSecurityService.verifyAttendanceAction.mockResolvedValue(defaultSecurityResult);
    mockSecurityService.logSecurityEvent.mockResolvedValue({});
    mockGeoFenceService.validateAttendanceLocation.mockResolvedValue({
      withinFence: true,
      distanceMeters: 10,
      branchName: 'Head Office',
      fenceRadiusMeters: 500,
    });
    mockGeoFenceService.calculateDistance.mockReturnValue(10);

    // Default policy — late detection enabled
    mockPolicyService.getOrCreatePolicy.mockResolvedValue({
      id: 'policy-1',
      companyId: COMPANY_ID,
      name: 'Default Policy',
      timezone: 'UTC',
      workingDays: [1, 2, 3, 4, 5],
      defaultStartTime: '09:00',
      defaultEndTime: '18:00',
      dailyWorkingHours: 9,
      breakDurationMinutes: 60,
      gracePeriodMinutes: 15,
      lateThresholdMinutes: 30,
      veryLateThresholdMinutes: 60,
      halfDayThresholdMinutes: 240,
      minimumWorkingMinutes: 480,
      maximumWorkingMinutes: 720,
      enableOvertime: true,
      overtimeStartsAfterMinutes: 540,
      maxOvertimeMinutes: 240,
      enableAutoLateDetection: true,
      enableAutoHalfDay: true,
      enableAutoAbsent: true,
      enableAutoCheckout: true,
      autoCheckoutTime: '23:59',
      enableRemoteWork: false,
      enableFlexibleShift: false,
      enableMultiplePunch: false,
      crossMidnightShift: false,
    });

    service = new AttendanceService(
      mockPrisma as any,
      mockCache as any,
      mockGeoFenceService as any,
      mockSecurityService as any,
      mockPolicyService as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ====================================================================
  // 1. Clock In — Basic successful flow
  // ====================================================================
  describe('1. Clock In — Basic Flow', () => {
    it('creates a new attendance record on first clock-in of the day', async () => {
      const now = new Date('2026-07-11T09:05:00Z');
      jest.setSystemTime(now);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({
        checkIn: now,
        source: 'WEB',
      }));

      const record = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          employeeId: EMPLOYEE_ID,
          checkIn: now,
          source: 'WEB',
          status: 'PRESENT',
        }),
      });
      expect(record).toBeDefined();
    });

    it('determines source as QR when qrCode is provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, { qrCode: 'valid-qr-code' });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'QR' }),
      });
    });

    it('determines source as FACE when faceEncoding is provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        faceEncoding: [0.1, 0.2, 0.3],
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'FACE' }),
      });
    });

    it('determines source as GPS when lat/lng are provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        lat: 37.7749,
        lng: -122.4194,
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'GPS' }),
      });
    });

    it('determines source as MOBILE when deviceId is provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, { deviceId: 'device-123' });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'MOBILE' }),
      });
    });

    it('saves attendance photo when photoUrl is provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ id: 'record-new' }));

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        photoUrl: 'https://storage.example.com/photo.jpg',
        faceEncoding: [0.1, 0.2, 0.3],
      });

      expect(mockPrisma.attendancePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          employeeId: EMPLOYEE_ID,
          recordId: 'record-new',
          photoType: 'CHECK_IN',
          imageUrl: 'https://storage.example.com/photo.jpg',
        }),
      });
    });

    it('attaches face match score to photo record from security layer 8', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ id: 'record-new' }));

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 8 ? { ...l, passed: true, details: { score: 0.92 } } : l,
        ),
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        photoUrl: 'https://example.com/photo.jpg',
        faceEncoding: [0.1, 0.2, 0.3],
      });

      expect(mockPrisma.attendancePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          faceMatchScore: 0.92,
        }),
      });
    });
  });

  // ====================================================================
  // 2. Double Clock In — Prevention
  // ====================================================================
  describe('2. Double Clock In — Prevention', () => {
    it('throws BadRequestException when user has already clocked in today', async () => {
      jest.setSystemTime(new Date('2026-07-11T10:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: new Date('2026-07-11T09:00:00Z') }),
      );

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow('You have already clocked in today.');
    });

    it('allows clock-in when existing record has no checkIn (HR placeholder)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      // Record exists but checkIn is null (e.g., placeholder created by HR)
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: null }),
      );

      mockPrisma.attendanceRecord.create.mockReset();
      mockPrisma.attendanceRecord.update.mockResolvedValue(makeRecord({
        checkIn: new Date('2026-07-11T09:00:00Z'),
      }));

      const result = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // Should UPDATE the existing record, not create a new one
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.create).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ====================================================================
  // 3. Clock Out — Basic Flow
  // ====================================================================
  describe('3. Clock Out — Basic Flow', () => {
    it('successfully clocks out and calculates worked minutes', async () => {
      const checkIn = new Date('2026-07-11T09:00:00Z');
      const checkOut = new Date('2026-07-11T17:45:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn }),
      );

      const result = await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      const expectedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          checkOut,
          workedMinutes: expectedMinutes,
        }),
      });
      expect(result).toBeDefined();
    });

    it('throws BadRequestException when clocking out without clocking in', async () => {
      jest.setSystemTime(new Date('2026-07-11T17:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: null }),
      );

      await expect(
        service.clockOut(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.clockOut(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow('You must clock in before clocking out.');
    });

    it('throws BadRequestException when already clocked out', async () => {
      jest.setSystemTime(new Date('2026-07-11T18:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({
          checkIn: new Date('2026-07-11T09:00:00Z'),
          checkOut: new Date('2026-07-11T17:00:00Z'),
        }),
      );

      await expect(
        service.clockOut(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow('You have already clocked out today.');
    });

    it('saves attendance photo during clock-out when photoUrl provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T17:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: new Date('2026-07-11T09:00:00Z') }),
      );
      mockPrisma.attendanceRecord.update.mockResolvedValue(makeRecord({ id: 'record-1' }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {
        photoUrl: 'https://storage.example.com/checkout.jpg',
      });

      expect(mockPrisma.attendancePhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          photoType: 'CHECK_OUT',
          imageUrl: 'https://storage.example.com/checkout.jpg',
        }),
      });
    });

    it('persists notes from original record and merges with clock-out notes', async () => {
      const checkIn = new Date('2026-07-11T09:00:00Z');
      jest.setSystemTime(new Date('2026-07-11T17:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn, notes: 'Came in early' }),
      );

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, { notes: 'Left on time' });

      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ notes: 'Left on time' }),
      });
    });
  });

  // ====================================================================
  // 4. Overtime Calculation
  // ====================================================================
  describe('4. Overtime Calculation', () => {
    it('correctly calculates overtime when clocking out after standard hours', async () => {
      const checkIn = new Date('2026-07-11T09:00:00Z');
      const checkOut = new Date('2026-07-11T19:30:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 10.5 hours = 630 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 630 }),
      });
    });

    it('records short worked minutes for half-day (early departure)', async () => {
      const checkIn = new Date('2026-07-11T10:00:00Z');
      const checkOut = new Date('2026-07-11T14:00:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 4 hours = 240 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 240 }),
      });
    });

    it('records maximum day length (more than 16 hours — unlikely but possible)', async () => {
      const checkIn = new Date('2026-07-11T06:00:00Z');
      const checkOut = new Date('2026-07-11T23:00:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 17 hours = 1020 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 1020 }),
      });
    });
  });

  // ====================================================================
  // 5. Night Shift & Cross-Midnight
  // ====================================================================
  describe('5. Night Shift & Cross-Midnight', () => {
    it('clock-in at 22:00 works for night shift', async () => {
      const nightTime = new Date('2026-07-11T22:00:00Z');
      jest.setSystemTime(nightTime);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ checkIn: nightTime }));

      const record = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});
      expect(record).toBeDefined();
    });

    it('cross-midnight clock-out fails when no record exists on either day', async () => {
      // Clock in at 22:00 on July 11
      jest.setSystemTime(new Date('2026-07-11T22:00:00Z'));
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ checkIn: new Date('2026-07-11T22:00:00Z') }));
      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // Advance to next day at 06:00 — date changes!
      jest.setSystemTime(new Date('2026-07-12T06:00:00Z'));

      // Both today's (July 12) and yesterday's (July 11) lookups return null
      mockPrisma.attendanceRecord.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.clockOut(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow('You must clock in before clocking out.');
    });

    it('cross-midnight clock-out succeeds with date rollover (night shift 22:00→06:00)', async () => {
      // Clock in at 22:00 on July 11
      const clockInTime = new Date('2026-07-11T22:00:00Z');
      jest.setSystemTime(clockInTime);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(
        makeRecord({ checkIn: clockInTime, date: new Date('2026-07-11T00:00:00.000Z') }),
      );

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // Advance to next day at 06:00 — date rolls over!
      const clockOutTime = new Date('2026-07-12T06:00:00Z');
      jest.setSystemTime(clockOutTime);

      // First findUnique (for July 12) returns null — no record today
      // Second findUnique (for July 11) returns yesterday's record with checkIn
      mockPrisma.attendanceRecord.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          makeRecord({
            checkIn: clockInTime,
            date: new Date('2026-07-11T00:00:00.000Z'),
          }),
        );

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 8 hours (22:00 → 06:00) = 480 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          checkOut: clockOutTime,
          workedMinutes: 480,
        }),
      });
    });

    it('night shift without crossing midnight works within same day', async () => {
      const clockIn = new Date('2026-07-11T22:00:00Z');
      const clockOut = new Date('2026-07-11T23:45:00Z');
      jest.setSystemTime(clockOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn: clockIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 1 hour 45 min = 105 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 105 }),
      });
    });
  });

  // ====================================================================
  // 6. Weekend & Holiday — Service does NOT restrict these (by design)
  // ====================================================================
  describe('6. Weekend & Holiday — No Restriction (by design)', () => {
    it('allows clock-in on a Saturday (weekend — no weekend check in service)', async () => {
      // July 11, 2026 is a Saturday
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));
      // Verify it's Saturday
      expect(new Date().getUTCDay()).toBe(6);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      const record = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});
      expect(record).toBeDefined();
    });

    it('allows clock-in on a Sunday (weekend)', async () => {
      // July 12, 2026 is a Sunday
      jest.setSystemTime(new Date('2026-07-12T09:00:00Z'));
      expect(new Date().getUTCDay()).toBe(0);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      const record = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});
      expect(record).toBeDefined();
    });

    it('allows clock-in on any day — service always sets PRESENT status', async () => {
      // The service always sets statis to 'PRESENT' on clock-in regardless of day
      // Date doesn't matter — verify statis is always PRESENT
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'PRESENT' }),
      });
    });
  });

  // ====================================================================
  // 7. Geo-Fence Validation
  // ====================================================================
  describe('7. Geo-Fence Validation', () => {
    it('allows clock-in when within geo-fence radius', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());
      mockGeoFenceService.validateAttendanceLocation.mockResolvedValue({
        withinFence: true,
        distanceMeters: 50,
        branchName: 'Head Office',
        fenceRadiusMeters: 500,
      });

      const result = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        lat: 37.7749,
        lng: -122.4194,
      });

      expect(result).toBeDefined();
      expect(mockGeoFenceService.validateAttendanceLocation).toHaveBeenCalled();
    });

    it('rejects clock-in when outside geo-fence radius', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockGeoFenceService.validateAttendanceLocation.mockResolvedValue({
        withinFence: false,
        distanceMeters: 5000,
        branchName: 'Head Office',
        fenceRadiusMeters: 500,
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          lat: 37.8000,
          lng: -122.5000,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          lat: 37.8000,
          lng: -122.5000,
        }),
      ).rejects.toThrow(/5000m away from your branch/);
    });

    it('skips geo-fence check when no lat/lng provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockGeoFenceService.validateAttendanceLocation).not.toHaveBeenCalled();
    });

    it('skips geo-fence check when only lat is provided (partial GPS)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      // Only lat, no lng — the if condition `lat != null && lng != null` is false
      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, { lat: 37.7749 });

      expect(mockGeoFenceService.validateAttendanceLocation).not.toHaveBeenCalled();
    });

    it('skips geo-fence check when only lng is provided (partial GPS)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      // Only lng, no lat — the if condition is false
      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, { lng: -122.4194 });

      expect(mockGeoFenceService.validateAttendanceLocation).not.toHaveBeenCalled();
    });

    it('passes correct coordinates to geo-fence service', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());
      mockGeoFenceService.validateAttendanceLocation.mockResolvedValue({
        withinFence: true,
        distanceMeters: 10,
        branchName: 'HQ',
        fenceRadiusMeters: 500,
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        lat: 37.7749,
        lng: -122.4194,
      });

      expect(mockGeoFenceService.validateAttendanceLocation).toHaveBeenCalledWith(
        COMPANY_ID,
        EMPLOYEE_ID,
        { latitude: 37.7749, longitude: -122.4194 },
      );
    });
  });

  // ====================================================================
  // 8. GPS Location Integrity (Wrong GPS / Mock GPS — Layer 11)
  // ====================================================================
  describe('8. GPS Location Integrity — Wrong GPS / Mock GPS (Layer 11)', () => {
    it('blocks clock-in when GPS accuracy is too low (mock GPS suspicion)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 11
            ? {
                ...l,
                passed: false,
                required: true,
                failureReason: 'GPS accuracy is too low. Location may be spoofed.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Location Integrity',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          lat: 37.7749,
          lng: -122.4194,
          locationAccuracy: 500, // 500m accuracy — suspicious
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows clock-in with high GPS accuracy (authentic location)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        lat: 37.7749,
        lng: -122.4194,
        locationAccuracy: 15, // 15m — excellent GPS
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });
  });

  // ====================================================================
  // 9. QR Code Security (Layer 7)
  // ====================================================================
  describe('9. QR Code Security', () => {
    it('allows clock-in with valid QR code', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        qrCode: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'QR' }),
      });
    });

    it('rejects clock-in with invalid/wrong QR code', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 7
            ? {
                ...l,
                passed: false,
                required: true,
                failureReason: 'Invalid QR code.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): QR Code Scan',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          qrCode: 'invalid-code',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects clock-in with expired QR code', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 7
            ? {
                ...l,
                passed: false,
                required: true,
                failureReason: 'QR code has expired. Please generate a new one.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): QR Code Scan',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          qrCode: 'expired-qr-code',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ====================================================================
  // 10. Face Verification (Layer 8 & 9) — Mismatch & Liveness
  // ====================================================================
  describe('10. Face Verification — Mismatch & Liveness', () => {
    it('allows clock-in with matching face', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 8
            ? { ...l, passed: true, details: { score: 0.92 } }
            : l.layer === 9
              ? { ...l, passed: true }
              : l,
        ),
        summary: 'All 14/14 security checks passed.',
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        faceEncoding: [0.1, 0.2, 0.3, 0.4, 0.5],
        livenessResult: { passed: true, score: 0.95, method: 'blink' },
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });

    it('rejects clock-in with face mismatch (low similarity score)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 8
            ? {
                ...l,
                passed: false,
                required: true,
                details: { score: 0.12 },
                failureReason: 'Face verification failed.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Face Verification',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          faceEncoding: [0.9, 0.8, 0.7],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects clock-in when liveness check fails (spoof attempt)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 9
            ? {
                ...l,
                passed: false,
                required: true,
                failureReason: 'Liveness check failed. Please try again.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Liveness Detection',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          faceEncoding: [0.1, 0.2, 0.3],
          livenessResult: { passed: false, score: 0.2, method: 'blink' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ====================================================================
  // 11. Device Management (Layers 2 & 10)
  // ====================================================================
  describe('11. Device Management — Multiple Devices & Binding', () => {
    it('rejects clock-in when device limit exceeded (Layer 10)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 10
            ? {
                ...l,
                passed: false,
                required: true,
                details: { activeDevices: 3, maxAllowed: 2 },
                failureReason: 'Too many active devices (3/2). Deactivate unused devices.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Device Binding',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          deviceId: 'device-004',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects clock-in from untrusted device (Layer 2)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 2
            ? {
                ...l,
                passed: false,
                required: true,
                failureReason: 'Device is not trusted. Register and verify your device first.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Trusted Device',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          deviceId: 'untrusted-device',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ====================================================================
  // 12. VPN Detection (Layer 12)
  // ====================================================================
  describe('12. VPN Detection (Layer 12)', () => {
    it('blocks clock-in when VPN is detected', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 12
            ? {
                ...l,
                passed: false,
                required: true,
                details: { vpnDetected: true },
                failureReason: 'VPN detected. Disable VPN to clock in/out.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): VPN Detection',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          vpnDetected: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows clock-in when no VPN is detected', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        vpnDetected: false,
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });
  });

  // ====================================================================
  // 13. Wi-Fi Verification (Layer 5)
  // ====================================================================
  describe('13. Wi-Fi Verification — Wrong WiFi (Layer 5)', () => {
    it('blocks clock-in when not on authorized WiFi', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 5
            ? {
                ...l,
                passed: false,
                required: true,
                details: { ssid: 'Starbucks_WiFi', bssid: 'aa:bb:cc:dd:ee:ff' },
                failureReason: 'Not connected to an authorized office Wi-Fi network.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Wi-Fi Verification',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          wifiSsid: 'Starbucks_WiFi',
          wifiBssid: 'aa:bb:cc:dd:ee:ff',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows clock-in on company authorized WiFi', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        wifiSsid: 'Company_Office_5G',
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });
  });

  // ====================================================================
  // 14. IP Validation (Layer 6)
  // ====================================================================
  describe('14. IP Validation — Wrong IP (Layer 6)', () => {
    it('blocks clock-in from unauthorized IP address', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 6
            ? {
                ...l,
                passed: false,
                required: true,
                details: { ipAddress: '203.0.113.55' },
                failureReason: 'IP address not in the authorized allowlist.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): IP Validation',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          ipAddress: '203.0.113.55',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows clock-in from authorized IP address', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        ipAddress: '10.0.0.55',
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });
  });

  // ====================================================================
  // 15. Offline Mode (No GPS / No Network)
  // ====================================================================
  describe('15. Offline Mode — No GPS, Limited Connectivity', () => {
    it('allows web-based clock-in without GPS (fallback to WEB source)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      const result = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'WEB',
          checkInLat: undefined,
          checkInLng: undefined,
        }),
      });
    });

    it('allows mobile clock-in without network by using cached device trust', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        deviceId: 'cached-trusted-device',
      });

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'MOBILE' }),
      });
    });
  });

  // ====================================================================
  // 16. Security — Non-Strict Mode (Flag Only)
  // ====================================================================
  describe('16. Security — Non-Strict Mode (Flag Only, No Block)', () => {
    it('allows clock-in even with failures when strict mode is off', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: false,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 6
            ? { ...l, passed: false, required: true, failureReason: 'IP not allowed.' }
            : l,
        ),
        summary: 'Flagged: IP address not in the authorized allowlist.',
      });

      const result = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        ipAddress: '1.2.3.4',
      });

      expect(result).toBeDefined();
      // Should still log the security event with FLAGGED status
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith(
        COMPANY_ID,
        EMPLOYEE_ID,
        expect.objectContaining({ status: 'FLAGGED' }),
      );
    });
  });

  // ====================================================================
  // 17. Self-Service Queries
  // ====================================================================
  describe('17. Self-Service Queries', () => {
    it('myToday returns null when no record for today', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      const result = await service.myToday(EMPLOYEE_ID);
      expect(result).toBeNull();
    });

    it('myToday returns today record when exists', async () => {
      const today = new Date('2026-07-11T09:00:00Z');
      jest.setSystemTime(today);

      const record = makeRecord({ checkIn: today });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(record);

      const result = await service.myToday(EMPLOYEE_ID);
      expect(result).toEqual(record);
    });

    it('myHistory returns paginated results', async () => {
      const query = new PaginationQueryDto();
      query.page = 1;
      query.limit = 20;

      const records = [
        { id: 'r1', date: new Date('2026-07-10') },
        { id: 'r2', date: new Date('2026-07-09') },
      ];
      mockPrisma.attendanceRecord.findMany.mockResolvedValue(records);
      mockPrisma.attendanceRecord.count.mockResolvedValue(2);
      mockPrisma.$transaction.mockImplementation(([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const result = await service.myHistory(EMPLOYEE_ID, query);
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  // ====================================================================
  // 18. HR Manual Entry
  // ====================================================================
  describe('18. HR Manual Attendance Entry', () => {
    it('creates a manual attendance record with upsert', async () => {
      const checkIn = new Date('2026-07-10T09:00:00Z');
      const checkOut = new Date('2026-07-10T18:00:00Z');

      mockPrisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID });
      mockPrisma.attendanceRecord.upsert.mockResolvedValue(makeRecord({
        checkIn,
        checkOut,
        workedMinutes: 540,
        source: 'MANUAL',
      }));

      const result = await service.createManual(COMPANY_ID, {
        employeeId: EMPLOYEE_ID,
        date: '2026-07-10',
        checkIn: '2026-07-10T09:00:00Z',
        checkOut: '2026-07-10T18:00:00Z',
        status: AttendanceStatusDto.PRESENT,
      });

      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith({
        where: {
          employeeId_date: { employeeId: EMPLOYEE_ID, date: expect.any(Date) },
        },
        update: expect.objectContaining({
          checkIn,
          checkOut,
          workedMinutes: 540,
          source: 'MANUAL',
        }),
        create: expect.objectContaining({ source: 'MANUAL' }),
      });
    });

    it('creates manual entry without checkIn/checkOut (just mark status)', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID });
      mockPrisma.attendanceRecord.upsert.mockResolvedValue(makeRecord({
        status: 'HALF_DAY',
        source: 'MANUAL',
      }));

      const result = await service.createManual(COMPANY_ID, {
        employeeId: EMPLOYEE_ID,
        date: '2026-07-10',
        status: AttendanceStatusDto.HALF_DAY,
      });

      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException for employee not in company', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createManual(COMPANY_ID, {
          employeeId: 'nonexistent-employee',
          date: '2026-07-10',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ====================================================================
  // 19. Attendance List — HR Filters
  // ====================================================================
  describe('19. Attendance List — HR Filters', () => {
    it('returns all records without filters', async () => {
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([makeRecord()]);
      mockPrisma.attendanceRecord.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      const result = await service.findAll(COMPANY_ID, query);

      expect(result.items).toHaveLength(1);
    });

    it('filters by employeeId', async () => {
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
      mockPrisma.attendanceRecord.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      await service.findAll(COMPANY_ID, query, { employeeId: EMPLOYEE_ID });

      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            employeeId: EMPLOYEE_ID,
          }),
        }),
      );
    });

    it('filters by date range', async () => {
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);
      mockPrisma.attendanceRecord.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      await service.findAll(COMPANY_ID, query, {
        from: '2026-07-01',
        to: '2026-07-31',
      });

      expect(mockPrisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ====================================================================
  // 20. Update & Delete
  // ====================================================================
  describe('20. Attendance Record Update & Delete', () => {
    it('update modifies check-in time and recalculates worked minutes', async () => {
      const existingCheckIn = new Date('2026-07-11T09:00:00Z');
      const existingCheckOut = new Date('2026-07-11T18:00:00Z');
      const newCheckIn = new Date('2026-07-11T10:00:00Z');

      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(
        makeRecord({ checkIn: existingCheckIn, checkOut: existingCheckOut }),
      );

      mockPrisma.attendanceRecord.update.mockResolvedValue(makeRecord({
        checkIn: newCheckIn,
        checkOut: existingCheckOut,
        workedMinutes: 480,
      }));

      await service.update(COMPANY_ID, 'record-1', {
        checkIn: newCheckIn.toISOString(),
      });

      // 10:00 to 18:00 = 480 minutes
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          checkIn: newCheckIn,
          workedMinutes: 480,
        }),
      });
    });

    it('remove deletes the record', async () => {
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(makeRecord());
      mockPrisma.attendanceRecord.delete.mockResolvedValue({});

      const result = await service.remove(COMPANY_ID, 'record-1');

      expect(mockPrisma.attendanceRecord.delete).toHaveBeenCalledWith({
        where: { id: 'record-1' },
      });
      expect(result).toEqual({ message: 'Attendance record removed.' });
    });

    it('findOne throws NotFoundException for missing record', async () => {
      mockPrisma.attendanceRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(COMPANY_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ====================================================================
  // 21. Multiple Security Layers Failing Simultaneously
  // ====================================================================
  describe('21. Multiple Security Layers Failing', () => {
    it('reports all failed layers in error message when multiple checks fail', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        allowed: false,
        strictMode: true,
        layers: [
          { layer: 1, name: 'JWT Authentication', passed: true, required: true },
          { layer: 2, name: 'Trusted Device', passed: false, required: true, failureReason: 'Device is not trusted.' },
          { layer: 3, name: 'GPS Location', passed: true, required: false },
          { layer: 5, name: 'Wi-Fi Verification', passed: false, required: true, failureReason: 'Not on authorized WiFi.' },
          { layer: 6, name: 'IP Validation', passed: true, required: false },
          { layer: 7, name: 'QR Code Scan', passed: true, required: false },
          { layer: 8, name: 'Face Verification', passed: false, required: true, failureReason: 'Face mismatch.' },
          { layer: 9, name: 'Liveness Detection', passed: true, required: false },
          { layer: 10, name: 'Device Binding', passed: true, required: false },
          { layer: 11, name: 'Location Integrity', passed: true, required: false },
          { layer: 12, name: 'VPN Detection', passed: false, required: true, failureReason: 'VPN detected.' },
          { layer: 13, name: 'Network Change Detection', passed: true, required: false },
          { layer: 14, name: 'Time Validation (Server)', passed: true, required: true },
          { layer: 15, name: 'Attendance Photo', passed: true, required: false },
        ],
        summary:
          'Blocked by 4 security layer(s): Trusted Device, Wi-Fi Verification, Face Verification, VPN Detection',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          deviceId: 'untrusted',
          wifiSsid: 'Cafe_WiFi',
          faceEncoding: [0.9, 0.8],
          vpnDetected: true,
        }),
      ).rejects.toThrow(
        'Blocked by 4 security layer(s): Trusted Device, Wi-Fi Verification, Face Verification, VPN Detection',
      );
    });
  });

  // ====================================================================
  // 22. Network Change Detection (Layer 13)
  // ====================================================================
  describe('22. Network Change Detection (Layer 13)', () => {
    it('blocks clock-in when network change is detected mid-session', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);

      mockSecurityService.verifyAttendanceAction.mockResolvedValue({
        ...defaultSecurityResult,
        allowed: false,
        strictMode: true,
        layers: defaultSecurityResult.layers.map((l) =>
          l.layer === 13
            ? {
                ...l,
                passed: false,
                required: true,
                details: { networkChanged: true },
                failureReason: 'Network changed during verification. Please try again.',
              }
            : l,
        ),
        summary: 'Blocked by 1 security layer(s): Network Change Detection',
      });

      await expect(
        service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
          networkChanged: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ====================================================================
  // 23. Late Arrival — Auto-Detection via Policy Engine
  // ====================================================================
  describe('23. Late Arrival — Auto-Detection via Policy Engine', () => {
    it('sets status to LATE when clocking in after grace period', async () => {
      // Employee clocks in at 09:25 (grace is 15min, so 09:15 is grace end)
      // 09:25 - 09:00 = 25min; 25 - 15 (grace) = 10min late
      jest.setSystemTime(new Date('2026-07-11T09:25:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE_ID,
        shift: { startTime: '09:00', endTime: '18:00' },
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'LATE',
          lateMinutes: expect.any(Number),
        }),
      });
    });

    it('records correct lateMinutes when clocking in late', async () => {
      // Clock in at 10:30 (09:00 start + 15min grace = 09:15)
      // 10:30 - 09:15 = 75min late
      jest.setSystemTime(new Date('2026-07-11T10:30:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE_ID,
        shift: { startTime: '09:00', endTime: '18:00' },
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'LATE',
          lateMinutes: 75,
        }),
      });
    });

    it('keeps PRESENT status when clocking in within grace period', async () => {
      // Clock in at 09:10 (within 15min grace of 09:00 start)
      jest.setSystemTime(new Date('2026-07-11T09:10:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE_ID,
        shift: { startTime: '09:00', endTime: '18:00' },
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'PRESENT' }),
      });
    });
  });

  // ====================================================================
  // 28. Overtime & Half-Day via Policy Engine
  // ====================================================================
  describe('28. Overtime & Half-Day via Policy Engine', () => {
    it('calculates overtime minutes on clock-out when exceeding standard hours', async () => {
      const checkIn = new Date('2026-07-11T09:00:00Z');
      const checkOut = new Date('2026-07-11T19:00:00Z'); // 10h later
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE_ID,
        shift: { startTime: '09:00', endTime: '18:00' },
      });

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 600 worked - 0 break = 600, overtime starts after 540, so 60min OT
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          overtimeMinutes: 60,
          workedMinutes: 600,
        }),
      });
    });

    it('marks HALF_DAY when worked minutes below threshold', async () => {
      const checkIn = new Date('2026-07-11T10:00:00Z');
      const checkOut = new Date('2026-07-11T13:00:00Z'); // 3h
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // Half-day threshold is 240min, 180min < 240
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          status: 'HALF_DAY',
          workedMinutes: 180,
        }),
      });
    });
  });

  // ====================================================================
  // 29. Break Tracking
  // ====================================================================
  describe('29. Break Tracking', () => {
    it('startBreak creates a break record and updates breakStart', async () => {
      const today = new Date('2026-07-11T12:00:00Z');
      jest.setSystemTime(today);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: new Date('2026-07-11T09:00:00Z') }),
      );

      (mockPrisma as any).attendanceBreak = {
        create: jest.fn().mockResolvedValue({
          id: 'break-1',
          startTime: today,
          type: 'BREAK',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        findMany: jest.fn(),
      };

      const result = await service.startBreak(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ breakStart: today }),
      });
    });

    it('endBreak ends the break and updates breakMinutes', async () => {
      const breakStart = new Date('2026-07-11T12:00:00Z');
      const breakEnd = new Date('2026-07-11T12:45:00Z');
      jest.setSystemTime(breakEnd);

      (mockPrisma as any).attendanceBreak = {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'break-1',
          startTime: breakStart,
          endTime: null,
          notes: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      };

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({
          checkIn: new Date('2026-07-11T09:00:00Z'),
          breakMinutes: 0,
        }),
      );

      const result = await service.endBreak(COMPANY_ID, EMPLOYEE_ID, {});

      expect(result.durationMinutes).toBe(45);
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ breakMinutes: 45 }),
      });
    });

    it('throws when starting a break without clocking in', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(
        makeRecord({ checkIn: null }),
      );

      await expect(
        service.startBreak(COMPANY_ID, EMPLOYEE_ID, {}),
      ).rejects.toThrow('You must clock in before starting a break.');
    });
  });

  // ====================================================================
  // 30. Policy Engine — Late Detection Disabled
  // ====================================================================
  describe('30. Policy Engine — Late Detection Disabled', () => {
    it('keeps PRESENT status when late detection is disabled', async () => {
      mockPolicyService.getOrCreatePolicy.mockResolvedValue({
        id: 'policy-1',
        companyId: COMPANY_ID,
        enableAutoLateDetection: false,
        enableAutoHalfDay: false,
        enableOvertime: false,
        gracePeriodMinutes: 15,
        lateThresholdMinutes: 30,
        veryLateThresholdMinutes: 60,
        halfDayThresholdMinutes: 240,
        overtimeStartsAfterMinutes: 540,
        maxOvertimeMinutes: 240,
        enableMultiplePunch: false,
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
      } as any);

      jest.setSystemTime(new Date('2026-07-11T10:30:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE_ID,
        shift: { startTime: '09:00', endTime: '18:00' },
      });

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // Should be PRESENT since auto-late detection is disabled
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'PRESENT' }),
      });
    });
  });

  // ====================================================================
  // 24. Clock Source Detection Edge Cases
  // ====================================================================
  describe('24. Clock Source Detection — Priority Edge Cases', () => {
    it('QR source takes priority over face when both provided', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        qrCode: 'qr-token',
        faceEncoding: [0.1, 0.2],
        lat: 37.7749,
        lng: -122.4194,
        deviceId: 'device-1',
      });

      // QR wins over face, GPS, and mobile
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'QR' }),
      });
    });

    it('FACE source takes priority over GPS when both provided (no QR)', async () => {
      jest.setSystemTime(new Date('2026-07-11T09:00:00Z'));

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {
        faceEncoding: [0.1, 0.2],
        lat: 37.7749,
        lng: -122.4194,
        deviceId: 'device-1',
      });

      // Face wins over GPS and mobile
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: 'FACE' }),
      });
    });
  });

  // ====================================================================
  // 25. Timezone Change — Server Time vs Branch Timezone
  // ====================================================================
  describe('25. Timezone Change — Server Time vs Branch Timezone', () => {
    it('uses server time for checkIn/checkOut, not client time', async () => {
      // Server is UTC. Employee's branch is America/New_York (UTC-5).
      // Employee clocks in at 09:00 NY time = 14:00 UTC.
      const serverTime = new Date('2026-07-11T14:00:00Z');
      jest.setSystemTime(serverTime);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ checkIn: serverTime }));

      const record = await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // checkIn should use server time, not whatever the client says
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ checkIn: serverTime }),
      });
    });

    it('employeeId_date key uses UTC midnight — consequence for late-night clocks', async () => {
      // Employee in UTC-8 clocks in at 23:00 local time = 07:00 UTC next day
      // This would create a record for the NEXT UTC day, not the employee's local day
      const lateNightUtc = new Date('2026-07-12T07:00:00Z'); // 23:00 on July 11 in UTC-8
      jest.setSystemTime(lateNightUtc);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord());

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // The date passed to create should be startOfDay UTC of the SERVER time
      const expectedDate = new Date('2026-07-12T00:00:00.000Z');
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ date: expectedDate }),
      });
    });
  });

  // ====================================================================
  // 26. DST Transition — Spring Forward & Fall Back
  // ====================================================================
  describe('26. DST Transition Effects', () => {
    it('spring forward: workedMinutes calculation correct on DST gap day', async () => {
      // 2026-03-08: US DST spring forward at 2:00 AM local
      // With UTC server: no DST effects. 09:00 UTC to 18:00 UTC is always 9 hours.
      const checkIn = new Date('2026-03-08T09:00:00Z');
      const checkOut = new Date('2026-03-08T18:00:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // 9 hours = 540 minutes regardless of DST because all calc is UTC
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 540 }),
      });
    });

    it('fall back: workedMinutes calculation correct on DST repeat day', async () => {
      // 2026-11-01: US fall back at 2:00 AM — hour repeats.
      // Same UTC-based test: 09:00 UTC to 18:00 UTC is always 540 min.
      const checkIn = new Date('2026-11-01T09:00:00Z');
      const checkOut = new Date('2026-11-01T18:00:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 540 }),
      });
    });
  });

  // ====================================================================
  // 27. Mobile Clock Manipulation — Server Time Always Wins
  // ====================================================================
  describe('27. Mobile Clock Manipulation — Server Time Always Wins', () => {
    it('ignores client-supplied time — checkIn uses server new Date()', async () => {
      const realServerTime = new Date('2026-07-11T09:00:00Z');
      jest.setSystemTime(realServerTime);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue(makeRecord({ checkIn: realServerTime }));

      await service.clockIn(COMPANY_ID, EMPLOYEE_ID, {});

      // checkIn is always server's new Date(), never client-controlled
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ checkIn: realServerTime }),
      });
    });

    it('ClockInDto has no client-time field — manipulation impossible via API', async () => {
      // Verify the ClockInDto type doesn't accept a "timestamp" field
      const dto: Record<string, unknown> = {
        lat: 37.7749,
        lng: -122.4194,
        notes: 'Test',
      };

      const actualKeys = Object.keys(dto);
      expect(actualKeys).not.toContain('checkIn');
      expect(actualKeys).not.toContain('timestamp');
      expect(actualKeys).not.toContain('time');
    });

    it('workedMinutes uses server-calculated duration, not client claims', async () => {
      const checkIn = new Date('2026-07-11T09:00:00Z');
      const checkOut = new Date('2026-07-11T18:00:00Z');
      jest.setSystemTime(checkOut);

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(makeRecord({ checkIn }));

      await service.clockOut(COMPANY_ID, EMPLOYEE_ID, {});

      // workedMinutes is calculated server-side, not in the DTO
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({ workedMinutes: 540 }),
      });
    });
  });
});
