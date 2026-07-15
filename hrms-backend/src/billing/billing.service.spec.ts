import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prisma = {
    billingPlan: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      count: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    featureFlag: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    companyFeatureFlag: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    companyBranding: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(prisma, configService);
    (service as any).stripe = null;
  });

  // ====================================================================
  // 1. findAllPlans (public endpoint)
  // ====================================================================
  describe('1. findAllPlans', () => {
    it('returns only active plans sorted by sortOrder', async () => {
      const plans = [
        { id: 'plan-1', name: 'Starter', sortOrder: 0, isActive: true },
        { id: 'plan-2', name: 'Growth', sortOrder: 1, isActive: true },
        { id: 'plan-3', name: 'Enterprise', sortOrder: 2, isActive: true },
      ];
      prisma.billingPlan.findMany.mockResolvedValue(plans);

      const result = await service.findAllPlans();

      expect(result).toEqual(plans);
      expect(prisma.billingPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('excludes inactive plans from results', async () => {
      const activePlans = [
        { id: 'plan-1', name: 'Starter', sortOrder: 0, isActive: true },
        { id: 'plan-3', name: 'Enterprise', sortOrder: 2, isActive: true },
      ];
      prisma.billingPlan.findMany.mockResolvedValue(activePlans);

      const result = await service.findAllPlans();

      // Only active plans returned
      expect(result).toHaveLength(2);
      expect(result.every(p => p.isActive)).toBe(true);
      // The Prisma query filters by isActive: true
      expect(prisma.billingPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('returns empty array when no plans exist', async () => {
      prisma.billingPlan.findMany.mockResolvedValue([]);

      const result = await service.findAllPlans();

      expect(result).toEqual([]);
    });

    it('returns plans sorted by sortOrder ascending', async () => {
      const unsorted = [
        { id: 'plan-3', name: 'Enterprise', sortOrder: 2, isActive: true },
        { id: 'plan-1', name: 'Starter', sortOrder: 0, isActive: true },
        { id: 'plan-2', name: 'Growth', sortOrder: 1, isActive: true },
      ];
      prisma.billingPlan.findMany.mockResolvedValue(unsorted);

      const result = await service.findAllPlans();

      // Service expects Prisma to sort; verify the query includes sortOrder
      expect(prisma.billingPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sortOrder: 'asc' },
        }),
      );
      // The result order reflects what Prisma returns (mocked as unsorted above)
      expect(result).toEqual(unsorted);
    });
  });

  // ====================================================================
  // 2. Employee Limit Check
  // ====================================================================
  it('treats an exact employee limit as allowed', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'company-1', billingPlan: { maxEmployees: 10 } });
    prisma.employee.count.mockResolvedValue(10);

    await expect(service.checkEmployeeLimit('company-1')).resolves.toEqual({
      allowed: true,
      max: 10,
      current: 10,
    });
  });

  // ====================================================================
  // 3. Subscription Update
  // ====================================================================
  it('persists the selected billing cycle on subscription updates', async () => {
    jest.spyOn(service, 'findOnePlan').mockResolvedValue({
      id: 'plan-1',
      slug: 'professional',
      name: 'Professional',
      maxEmployees: 50,
      minMonthlyFee: 100,
      pricePerEmployee: 0,
      includedEmployees: 25,
      annualDiscountPercent: 10,
    } as any);

    prisma.company.findUnique.mockResolvedValue({
      id: 'company-1',
      subscriptionPlan: 'TRIAL',
      billingCycle: 'MONTHLY',
      stripeCustomerId: null,
    });
    prisma.employee.count.mockResolvedValue(5);
    prisma.company.update.mockResolvedValue({ id: 'company-1' });

    await service.updateCompanySubscription('company-1', { billingPlanId: 'plan-1', billingCycle: 'YEARLY' });

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: expect.objectContaining({
        billingPlanId: 'plan-1',
        billingCycle: 'YEARLY',
        subscriptionPlan: 'PROFESSIONAL',
        trialEndsAt: null,
        status: 'ACTIVE',
      }),
    });
  });
});