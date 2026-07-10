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

  it('treats an exact employee limit as allowed', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: 'company-1', billingPlan: { maxEmployees: 10 } });
    prisma.employee.count.mockResolvedValue(10);

    await expect(service.checkEmployeeLimit('company-1')).resolves.toEqual({
      allowed: true,
      max: 10,
      current: 10,
    });
  });

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