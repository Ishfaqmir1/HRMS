import { Test, TestingModule } from '@nestjs/testing';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

describe('LeaveService', () => {
  let leaveService: LeaveService;

  const mockPrisma = {
    leaveRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    leaveBalance: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
    leaveType: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    attendancePolicy: {
      findUnique: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const mockCache = {
    delPattern: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
  } as any;

  const COMPANY_ID = 'company-1';
  const EMPLOYEE_ID = 'employee-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisCacheService, useValue: mockCache },
      ],
    }).compile();

    leaveService = module.get<LeaveService>(LeaveService);

    mockPrisma.leaveType.findMany.mockResolvedValue([
      { id: 'lt-1', name: 'Annual Leave', slug: 'annual', daysPerYear: 20, isPaid: true, requiresApproval: true },
      { id: 'lt-2', name: 'Sick Leave', slug: 'sick', daysPerYear: 12, isPaid: true, requiresApproval: true },
    ]);
    mockPrisma.leaveBalance.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.count.mockResolvedValue(0);
    // Sandwich rule mocks: no attendance policy (defaults to Mon-Fri), no holidays
    mockPrisma.attendancePolicy.findUnique.mockResolvedValue(null);
    mockPrisma.holiday.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async ([...queries]: any) =>
      Promise.all(queries),
    );
  });

  // ====================================================================
  // 1. Leave Balance
  // ====================================================================
  describe('1. Leave Balance', () => {
    it('returns balances with leave type info', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([
        { id: 'lb-1', employeeId: EMPLOYEE_ID, leaveTypeId: 'lt-1', year: 2026, allocated: 20, used: 5, carriedForward: 0, leaveType: { name: 'Annual Leave' } },
      ]);

      const result = await leaveService.myBalances(EMPLOYEE_ID, 2026);

      expect(result).toHaveLength(1);
      expect(result[0].leaveType.name).toBe('Annual Leave');
    });

    it('defaults to current year when not specified', async () => {
      const currentYear = new Date().getFullYear();
      mockPrisma.leaveBalance.findMany.mockResolvedValue([]);

      await leaveService.myBalances(EMPLOYEE_ID);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: { employeeId: EMPLOYEE_ID, year: currentYear },
        select: {
          id: true,
          allocated: true,
          used: true,
          carriedForward: true,
          leaveType: { select: { id: true, name: true, code: true, isPaid: true, requiresApproval: true } },
        },
      });
    });

    it('sets balance via upsert', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID });
      mockPrisma.leaveBalance.upsert.mockResolvedValue({
        id: 'lb-1', allocated: 15, used: 0, carriedForward: 0,
      });

      const result = await leaveService.setBalance(COMPANY_ID, {
        employeeId: EMPLOYEE_ID,
        leaveTypeId: 'lt-1',
        year: 2026,
        allocated: 15,
      });

      expect(mockPrisma.leaveBalance.upsert).toHaveBeenCalled();
      expect(result.allocated).toBe(15);
    });
  });

  // ====================================================================
  // 2. Leave Request Creation
  // ====================================================================
  describe('2. Leave Request', () => {
    it('creates a leave request with PENDING status', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt-1', name: 'Annual Leave', daysPerYear: 20, isPaid: true, requiresApproval: true,
      });
      // Sandwich rule: Mon-Wed = 3 working days (no weekends/holidays in range)
      mockPrisma.leaveRequest.findFirst.mockResolvedValue(null); // no overlap
      mockPrisma.leaveBalance.findUnique.mockResolvedValue({
        allocated: 20, used: 0, carriedForward: 0,
      });
      mockPrisma.leaveRequest.create.mockResolvedValue({
        id: 'lr-1', status: 'PENDING', startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12'), totalDays: 3,
      });

      const result = await leaveService.createRequest(COMPANY_ID, EMPLOYEE_ID, {
        leaveTypeId: 'lt-1',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        reason: 'Vacation',
      });

      // 2026-08-10 is Monday, 2026-08-12 is Wednesday → 3 working days
      expect(result.status).toBe('PENDING');
      expect(mockPrisma.leaveRequest.create).toHaveBeenCalled();
      expect(mockPrisma.attendancePolicy.findUnique).toHaveBeenCalledWith({ where: { companyId: COMPANY_ID } });
      expect(mockPrisma.holiday.findMany).toHaveBeenCalled();
    });

    it('rejects overlapping leave requests', async () => {
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt-1', isPaid: true, requiresApproval: true,
      });
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'existing', startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12'),
      });
      mockPrisma.leaveBalance.findUnique.mockResolvedValue({
        allocated: 20, used: 0, carriedForward: 0,
      });

      await expect(
        leaveService.createRequest(COMPANY_ID, EMPLOYEE_ID, {
          leaveTypeId: 'lt-1',
          startDate: '2026-08-11',
          endDate: '2026-08-13',
          reason: 'Overlapping',
        }),
      ).rejects.toThrow(/overlap|conflict/i);
    });

    it('rejects when end date is before start date', async () => {
      // leaveType is NOT fetched because endDate < startDate check happens first
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt-1', isPaid: true, requiresApproval: true,
      });

      await expect(
        leaveService.createRequest(COMPANY_ID, EMPLOYEE_ID, {
          leaveTypeId: 'lt-1',
          startDate: '2026-08-15',
          endDate: '2026-08-10',
          reason: 'Invalid',
        }),
      ).rejects.toThrow(/endDate cannot be before/i);
    });
  });

  // ====================================================================
  // 3. Leave Approval
  // ====================================================================
  describe('3. Leave Approval', () => {
    it('approves a pending leave request', async () => {
      mockPrisma.leaveRequest.findFirst
        .mockResolvedValueOnce({
          id: 'lr-1', status: 'PENDING', employeeId: EMPLOYEE_ID, companyId: COMPANY_ID,
          startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12'),
          leaveTypeId: 'lt-1', totalDays: 3,
          leaveType: { id: 'lt-1', isPaid: true },
        });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lr-1', status: 'APPROVED' });
      // Mock balance check inside transaction: 15 available, 3 requested => OK
      mockPrisma.leaveBalance.findUnique.mockResolvedValue({
        allocated: 20, used: 5, carriedForward: 0,
      });
      mockPrisma.leaveBalance.upsert.mockResolvedValue({});

      const result = await leaveService.approve(COMPANY_ID, 'lr-1', 'manager-1');

      expect(result.status).toBe('APPROVED');
    });

    it('rejects approving already-processed request', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'lr-1', status: 'APPROVED', leaveType: { isPaid: false },
      });

      await expect(
        leaveService.approve(COMPANY_ID, 'lr-1', 'manager-1'),
      ).rejects.toThrow(/already been processed/i);
    });
  });

  // ====================================================================
  // 4. Leave Rejection
  // ====================================================================
  describe('4. Leave Rejection', () => {
    it('rejects a pending leave request with reason', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'lr-1', status: 'PENDING', employeeId: EMPLOYEE_ID, companyId: COMPANY_ID,
        startDate: new Date('2026-08-10'), endDate: new Date('2026-08-12'),
        leaveTypeId: 'lt-1', totalDays: 3,
        leaveType: { id: 'lt-1', isPaid: true },
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({
        id: 'lr-1', status: 'REJECTED', rejectionReason: 'Business needs',
      });

      const result = await leaveService.reject(COMPANY_ID, 'lr-1', { rejectionReason: 'Business needs' }, 'manager-1');

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Business needs');
    });
  });

  // ====================================================================
  // 5. Leave Cancellation
  // ====================================================================
  describe('5. Leave Cancellation', () => {
    it('cancels pending leave request', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'lr-1', status: 'PENDING', employeeId: EMPLOYEE_ID, companyId: COMPANY_ID,
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({ id: 'lr-1', status: 'CANCELLED' });

      const result = await leaveService.cancelMyRequest(EMPLOYEE_ID, 'lr-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('prevents cancelling approved leave', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'lr-1', status: 'APPROVED', employeeId: EMPLOYEE_ID,
      });

      await expect(
        leaveService.cancelMyRequest(EMPLOYEE_ID, 'lr-1'),
      ).rejects.toThrow(/only pending/i);
    });
  });

  // ====================================================================
  // 6. Leave Request Listing
  // ====================================================================
  describe('6. Leave Request Listing', () => {
    it('returns paginated leave requests', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-1', status: 'PENDING' },
        { id: 'lr-2', status: 'APPROVED' },
      ]);
      mockPrisma.leaveRequest.count.mockResolvedValue(2);
      mockPrisma.$transaction.mockImplementation(async ([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      const result = await leaveService.findAll(COMPANY_ID, query);

      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by employee', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async ([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      await leaveService.findAll(COMPANY_ID, query, { employeeId: EMPLOYEE_ID });

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: EMPLOYEE_ID }),
        }),
      );
    });
  });

  // ====================================================================
  // 7. My Requests
  // ====================================================================
  describe('7. My Requests', () => {
    it('returns paginated requests for the employee', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        { id: 'lr-1', status: 'PENDING', leaveType: { name: 'Annual' } },
      ]);
      mockPrisma.leaveRequest.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async ([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const query = new PaginationQueryDto();
      const result = await leaveService.myRequests(EMPLOYEE_ID, query);

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
