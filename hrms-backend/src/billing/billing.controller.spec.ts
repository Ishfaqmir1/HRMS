import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: jest.Mocked<BillingService>;

  const mockBillingService = {
    findAllPlans: jest.fn(),
    getCompanySubscription: jest.fn(),
    updateCompanySubscription: jest.fn(),
    findOnePlan: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    removePlan: jest.fn(),
    getMyInvoices: jest.fn(),
    generateInvoice: jest.fn(),
    markInvoicePaid: jest.fn(),
    createFeatureFlag: jest.fn(),
    findAllFeatureFlags: jest.fn(),
    getCompanyFeatureFlags: jest.fn(),
    toggleFeatureFlag: jest.fn(),
    getCompanyBranding: jest.fn(),
    updateCompanyBranding: jest.fn(),
    checkTrialStatus: jest.fn(),
    checkEmployeeLimit: jest.fn(),
    handleStripeWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    billingService = module.get(BillingService) as jest.Mocked<BillingService>;
  });

  // ====================================================================
  // 1. findAllPlans (public endpoint)
  // ====================================================================
  describe('1. findAllPlans — GET /billing/plans', () => {
    it('returns all active plans sorted by sortOrder', async () => {
      const plans = [
        { id: 'plan-1', name: 'Starter', slug: 'starter', sortOrder: 0, isActive: true },
        { id: 'plan-2', name: 'Growth', slug: 'growth', sortOrder: 1, isActive: true },
        { id: 'plan-3', name: 'Enterprise', slug: 'enterprise', sortOrder: 2, isActive: true },
      ];
      mockBillingService.findAllPlans.mockResolvedValue(plans as any);

      const result = await controller.findAllPlans();

      expect(result).toEqual(plans);
      expect(mockBillingService.findAllPlans).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no active plans exist', async () => {
      mockBillingService.findAllPlans.mockResolvedValue([]);

      const result = await controller.findAllPlans();

      expect(result).toEqual([]);
    });

    it('passes through full plan objects including pricing and features', async () => {
      const plan = {
        id: 'plan-growth',
        name: 'Growth',
        slug: 'growth',
        description: 'Best for growing teams',
        minMonthlyFee: 0,
        pricePerEmployee: 12,
        includedEmployees: 10,
        maxEmployees: 100,
        maxStorageGB: 50,
        annualDiscountPercent: 15,
        currency: 'USD',
        features: ['Employee management', 'Payroll', 'Leave management'],
        isActive: true,
        sortOrder: 1,
      };
      mockBillingService.findAllPlans.mockResolvedValue([plan] as any);

      const result = await controller.findAllPlans();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'plan-growth',
        name: 'Growth',
        pricePerEmployee: 12,
        features: expect.any(Array),
      });
    });

    it('does not require authentication (public endpoint)', () => {
      // The @Public() decorator means no auth guard is applied.
      // Verify the service method is callable without auth context.
      const metadata = Reflect.getMetadata('isPublic', BillingController.prototype.findAllPlans);
      expect(metadata).toBe(true);
    });
  });

  // ====================================================================
  // 2. createPlan (super admin only)
  // ====================================================================
  describe('2. createPlan — POST /billing/plans', () => {
    it('delegates to service and returns the created plan', async () => {
      const dto = {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'For large organizations',
        maxEmployees: 500,
        maxStorageGB: 200,
        pricePerEmployee: 25,
        currency: 'USD',
        sortOrder: 3,
      };
      const created = { id: 'plan-new', ...dto, isActive: true };
      mockBillingService.createPlan.mockResolvedValue(created as any);

      const result = await controller.createPlan(dto as any);

      expect(result).toEqual(created);
      expect(mockBillingService.createPlan).toHaveBeenCalledWith(dto);
    });

    it('requires admin roles guard', () => {
      const guards = Reflect.getMetadata('__guards__', BillingController.prototype.createPlan);
      expect(guards).toBeDefined();
    });
  });

  // ====================================================================
  // 3. Update plan
  // ====================================================================
  describe('3. updatePlan — PATCH /billing/plans/:id', () => {
    it('delegates to service with plan id and dto', async () => {
      const dto = { name: 'Updated Plan' };
      const updated = { id: 'plan-1', ...dto };
      mockBillingService.updatePlan.mockResolvedValue(updated as any);

      const result = await controller.updatePlan('plan-1', dto as any);

      expect(result).toEqual(updated);
      expect(mockBillingService.updatePlan).toHaveBeenCalledWith('plan-1', dto);
    });
  });

  // ====================================================================
  // 4. Delete (soft-delete) plan
  // ====================================================================
  describe('4. removePlan — DELETE /billing/plans/:id', () => {
    it('delegates to service to soft-delete the plan', async () => {
      const deactivated = { id: 'plan-1', isActive: false };
      mockBillingService.removePlan.mockResolvedValue(deactivated as any);

      const result = await controller.removePlan('plan-1');

      expect(result).toEqual(deactivated);
      expect(mockBillingService.removePlan).toHaveBeenCalledWith('plan-1');
    });
  });
});
