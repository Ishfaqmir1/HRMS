import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SetupWizardService } from './setup-wizard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SetupWizardService', () => {
  let service: SetupWizardService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      create: jest.fn(),
    },
    department: {
      create: jest.fn(),
    },
    shift: {
      create: jest.fn(),
    },
    leaveType: {
      create: jest.fn(),
    },
    attendancePolicy: {
      create: jest.fn(),
    },
    attendanceSecurityConfig: {
      create: jest.fn(),
    },
    complianceConfig: {
      create: jest.fn(),
    },
    companyBranding: {
      create: jest.fn(),
    },
    salaryStructure: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => {
      if (typeof cb === 'function') return cb(mockPrisma);
      return cb;
    }),
  } as any;

  const COMPANY_ID = 'company-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default mocks
    mockPrisma.company.findUnique.mockResolvedValue({
      id: COMPANY_ID,
      name: 'Test Corp',
      timezone: 'UTC',
      setupCompleted: false,
      setupSkippedAt: null,
      isActive: true,
      status: 'ACTIVE',
    });
    mockPrisma.company.update.mockResolvedValue({
      id: COMPANY_ID, setupCompleted: true,
    });
    mockPrisma.branch.create.mockResolvedValue({
      id: 'branch-1', name: 'Head Office', companyId: COMPANY_ID,
    });
    mockPrisma.department.create.mockResolvedValue({
      id: 'dept-1', name: 'General', companyId: COMPANY_ID,
    });
    mockPrisma.shift.create.mockResolvedValue({
      id: 'shift-1', name: 'General Shift', companyId: COMPANY_ID,
    });
    mockPrisma.leaveType.create.mockResolvedValue({
      id: 'lt-1', name: 'Annual Leave', code: 'AL', companyId: COMPANY_ID,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupWizardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SetupWizardService>(SetupWizardService);
    prisma = module.get(PrismaService) as any;
  });

  // ====================================================================
  // 1. getStatus
  // ====================================================================
  describe('1. getStatus', () => {
    it('returns setup required when company is active but setup not completed', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: false, setupSkippedAt: null,
        isActive: true, status: 'ACTIVE',
      });

      const result = await service.getStatus(COMPANY_ID);

      expect(result.setupRequired).toBe(true);
      expect(result.setupCompleted).toBe(false);
      expect(result.setupSkipped).toBe(false);
    });

    it('returns setup not required when setup is completed', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: true, setupSkippedAt: null,
        isActive: true, status: 'ACTIVE',
      });

      const result = await service.getStatus(COMPANY_ID);

      expect(result.setupRequired).toBe(false);
      expect(result.setupCompleted).toBe(true);
    });

    it('returns setup not required when setup was skipped', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: false, setupSkippedAt: new Date(),
        isActive: true, status: 'ACTIVE',
      });

      const result = await service.getStatus(COMPANY_ID);

      expect(result.setupRequired).toBe(false);
      expect(result.setupSkipped).toBe(true);
      expect(result.skippedAt).toBeDefined();
    });

    it('throws when company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('nonexistent'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ====================================================================
  // 2. runSetup
  // ====================================================================
  describe('2. runSetup', () => {
    it('creates all default entities in a transaction', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, name: 'Test Corp', timezone: 'UTC',
        setupCompleted: false, status: 'ACTIVE', isActive: true,
      });

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      const result = await service.runSetup(COMPANY_ID);

      // Verify all 3 main entities were created
      expect(mockPrisma.branch.create).toHaveBeenCalled();
      expect(mockPrisma.department.create).toHaveBeenCalled();
      expect(mockPrisma.shift.create).toHaveBeenCalled();
      expect(mockPrisma.leaveType.create).toHaveBeenCalledTimes(3); // AL, SL, PL
      expect(mockPrisma.attendancePolicy.create).toHaveBeenCalled();
      expect(mockPrisma.attendanceSecurityConfig.create).toHaveBeenCalled();
      expect(mockPrisma.complianceConfig.create).toHaveBeenCalled();
      expect(mockPrisma.companyBranding.create).toHaveBeenCalled();
      expect(mockPrisma.salaryStructure.create).toHaveBeenCalled();

      // Verify company was marked as completed
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: COMPANY_ID },
          data: expect.objectContaining({ setupCompleted: true }),
        }),
      );

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            action: 'SETUP_COMPLETED',
          }),
        }),
      );

      expect(result.message).toBe('Setup completed successfully.');
      expect(result.entities.branch).toBe('branch-1');
      expect(result.entities.department).toBe('dept-1');
      expect(result.entities.shift).toBe('shift-1');
    });

    it('throws when company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.runSetup(COMPANY_ID))
        .rejects.toThrow('Company not found');
    });

    it('throws when company is not active', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, isActive: false,
      });

      await expect(service.runSetup(COMPANY_ID))
        .rejects.toThrow('Company must be active before running setup');
    });

    it('throws when setup is already completed', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: true, isActive: true,
      });

      await expect(service.runSetup(COMPANY_ID))
        .rejects.toThrow('Setup has already been completed');
    });

    it('creates a head office branch with correct defaults', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, name: 'Test Corp', timezone: 'Asia/Kolkata',
        setupCompleted: false, status: 'ACTIVE', isActive: true,
      });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await service.runSetup(COMPANY_ID);

      expect(mockPrisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            name: 'Head Office',
            code: 'HQ',
            isHeadOffice: true,
            isActive: true,
            timezone: 'Asia/Kolkata',
          }),
        }),
      );
    });

    it('creates three default leave types', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, name: 'Test Corp', timezone: 'UTC',
        setupCompleted: false, status: 'ACTIVE', isActive: true,
      });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await service.runSetup(COMPANY_ID);

      expect(mockPrisma.leaveType.create).toHaveBeenCalledTimes(3);
      const leaveCalls = mockPrisma.leaveType.create.mock.calls.map(
        (call: any) => call[0].data.code,
      );
      expect(leaveCalls).toContain('AL');
      expect(leaveCalls).toContain('SL');
      expect(leaveCalls).toContain('PL');
    });

    it('sets working days to Mon-Fri for shift and policy', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, name: 'Test Corp', timezone: 'UTC',
        setupCompleted: false, status: 'ACTIVE', isActive: true,
      });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await service.runSetup(COMPANY_ID);

      expect(mockPrisma.shift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workingDays: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '18:00',
          }),
        }),
      );

      expect(mockPrisma.attendancePolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workingDays: [1, 2, 3, 4, 5],
          }),
        }),
      );
    });
  });

  // ====================================================================
  // 3. skipSetup
  // ====================================================================
  describe('3. skipSetup', () => {
    it('sets setupSkippedAt and logs audit', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: false,
      });

      const result = await service.skipSetup(COMPANY_ID);

      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: COMPANY_ID },
          data: expect.objectContaining({
            setupSkippedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SETUP_SKIPPED',
          }),
        }),
      );
      expect(result.message).toBe('Setup wizard skipped. You can run it later from settings.');
    });

    it('throws when company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.skipSetup('nonexistent'))
        .rejects.toThrow('Company not found');
    });

    it('throws when setup is already completed', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: COMPANY_ID, setupCompleted: true,
      });

      await expect(service.skipSetup(COMPANY_ID))
        .rejects.toThrow('Setup is already completed');
    });
  });
});
