import { Test, TestingModule } from '@nestjs/testing';
import { SetupWizardController } from './setup-wizard.controller';
import { SetupWizardService } from './setup-wizard.service';

describe('SetupWizardController', () => {
  let controller: SetupWizardController;
  let service: jest.Mocked<SetupWizardService>;

  const mockService = {
    getStatus: jest.fn(),
    runSetup: jest.fn(),
    skipSetup: jest.fn(),
  } as any;

  const COMPANY_ID = 'company-1';
  const USER_ID = 'user-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetupWizardController],
      providers: [
        { provide: SetupWizardService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<SetupWizardController>(SetupWizardController);
    service = module.get(SetupWizardService) as any;
  });

  // ====================================================================
  // 1. GET /setup/status
  // ====================================================================
  describe('1. getStatus', () => {
    it('returns setup status from service', async () => {
      mockService.getStatus.mockResolvedValue({
        setupCompleted: false,
        setupSkipped: false,
        skippedAt: null,
        isActive: true,
        status: 'ACTIVE',
        setupRequired: true,
      });

      const result = await controller.getStatus(COMPANY_ID);

      expect(result.setupRequired).toBe(true);
      expect(service.getStatus).toHaveBeenCalledWith(COMPANY_ID);
    });

    it('returns completed status when setup is done', async () => {
      mockService.getStatus.mockResolvedValue({
        setupCompleted: true,
        setupSkipped: false,
        skippedAt: null,
        isActive: true,
        status: 'ACTIVE',
        setupRequired: false,
      });

      const result = await controller.getStatus(COMPANY_ID);

      expect(result.setupCompleted).toBe(true);
      expect(result.setupRequired).toBe(false);
    });

    it('returns skipped status when setup was skipped', async () => {
      mockService.getStatus.mockResolvedValue({
        setupCompleted: false,
        setupSkipped: true,
        skippedAt: new Date().toISOString(),
        isActive: true,
        status: 'ACTIVE',
        setupRequired: false,
      });

      const result = await controller.getStatus(COMPANY_ID);

      expect(result.setupSkipped).toBe(true);
      expect(result.skippedAt).toBeDefined();
    });
  });

  // ====================================================================
  // 2. POST /setup/run
  // ====================================================================
  describe('2. runSetup', () => {
    it('runs setup and returns result', async () => {
      mockService.runSetup.mockResolvedValue({
        message: 'Setup completed successfully.',
        entities: {
          branch: 'branch-1',
          department: 'dept-1',
          shift: 'shift-1',
          annualLeaveType: 'lt-1',
        },
      });

      const result = await controller.runSetup(COMPANY_ID, USER_ID);

      expect(service.runSetup).toHaveBeenCalledWith(COMPANY_ID);
      expect(result.message).toBe('Setup completed successfully.');
      expect(result.entities.branch).toBe('branch-1');
    });

    it('throws when service throws', async () => {
      mockService.runSetup.mockRejectedValue(new Error('Setup already completed'));

      await expect(controller.runSetup(COMPANY_ID, USER_ID))
        .rejects.toThrow('Setup already completed');
    });
  });

  // ====================================================================
  // 3. POST /setup/skip
  // ====================================================================
  describe('3. skipSetup', () => {
    it('skips setup and returns message', async () => {
      mockService.skipSetup.mockResolvedValue({
        message: 'Setup wizard skipped. You can run it later from settings.',
      });

      const result = await controller.skipSetup(COMPANY_ID);

      expect(service.skipSetup).toHaveBeenCalledWith(COMPANY_ID);
      expect(result.message).toContain('skipped');
    });

    it('throws when service throws', async () => {
      mockService.skipSetup.mockRejectedValue(new Error('Setup is already completed'));

      await expect(controller.skipSetup(COMPANY_ID))
        .rejects.toThrow('Setup is already completed');
    });
  });
});
