import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBillingPlanDto, UpdateBillingPlanDto, UpdateCompanySubscriptionDto,
  CreateFeatureFlagDto, ToggleFeatureFlagDto, UpdateCompanyBrandingDto,
} from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: any = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize Stripe if secret key is configured
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      try {
        this.stripe = new (require('stripe'))(stripeKey);
      } catch {
        // Stripe not installed or configured
      }
    }
  }

  // ======================================================================
  // Billing Plans
  // ======================================================================

  async createPlan(dto: CreateBillingPlanDto) {
    return this.prisma.billingPlan.create({ data: dto });
  }

  async findAllPlans() {
    return this.prisma.billingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOnePlan(id: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Billing plan not found.');
    return plan;
  }

  async updatePlan(id: string, dto: UpdateBillingPlanDto) {
    await this.findOnePlan(id);
    return this.prisma.billingPlan.update({ where: { id }, data: dto });
  }

  async removePlan(id: string) {
    await this.findOnePlan(id);
    return this.prisma.billingPlan.update({ where: { id }, data: { isActive: false } });
  }

  // ======================================================================
  // Pricing Calculation
  // ======================================================================

  /**
   * Calculate the monthly cost for a company based on their plan and active employee count.
   *
   * For flat-rate plans (Starter): returns the flat fee regardless of employee count (within limits).
   * For per-employee plans (Growth/Business/Enterprise): pricePerEmployee × activeEmployees.
   * Annual billing applies a discount percentage.
   */
  calculateMonthlyCost(plan: { minMonthlyFee: number; pricePerEmployee: number; includedEmployees: number; annualDiscountPercent: number }, employeeCount: number, annual: boolean = false): number {
    let cost: number;

    if (plan.minMonthlyFee > 0) {
      // Flat-rate plan (e.g. Starter: ₹2,999 flat)
      cost = plan.minMonthlyFee;
    } else {
      // Per-employee pricing: pricePerEmployee × employeeCount
      cost = plan.pricePerEmployee * Math.max(0, employeeCount - plan.includedEmployees);
      if (plan.includedEmployees > 0 && employeeCount <= plan.includedEmployees) {
        cost = 0; // Included employees don't incur per-employee cost
      }
    }

    // Apply annual discount
    if (annual && plan.annualDiscountPercent > 0) {
      cost = cost * (1 - plan.annualDiscountPercent / 100);
    }

    return Math.max(0, Math.round(cost * 100) / 100);
  }

  // ======================================================================
  // Company Subscription Management
  // ======================================================================

  async getCompanySubscription(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { billingPlan: true, branding: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const employeeCount = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } },
    });

    const monthlyCost = company.billingPlan
      ? this.calculateMonthlyCost(company.billingPlan, employeeCount, company.billingCycle === 'YEARLY')
      : 0;

    const annualCost = company.billingPlan
      ? this.calculateMonthlyCost(company.billingPlan, employeeCount, true)
      : 0;

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      subscriptionPlan: company.subscriptionPlan,
      billingPlan: company.billingPlan,
      billingCycle: company.billingCycle,
      trialEndsAt: company.trialEndsAt,
      billingEmail: company.billingEmail,
      isActive: company.isActive,
      employeeCount,
      maxEmployees: company.billingPlan?.maxEmployees ?? null,
      monthlyCost,
      annualCost: annualCost * 12,
      branding: company.branding,
    };
  }

  async updateCompanySubscription(companyId: string, dto: UpdateCompanySubscriptionDto) {
    const plan = await this.findOnePlan(dto.billingPlanId);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    // Check employee limit
    const employeeCount = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } },
    });
    if (employeeCount > plan.maxEmployees) {
      throw new BadRequestException(
        `Plan "${plan.name}" allows max ${plan.maxEmployees} employees, but you have ${employeeCount}. Remove some employees or choose a higher plan.`,
      );
    }

    const updateData: any = {
      billingPlanId: plan.id,
      subscriptionPlan: plan.slug.toUpperCase() as any,
      billingCycle: dto.billingCycle || company.billingCycle || 'MONTHLY',
    };

    // If switching from TRIAL, clear trial
    if (company.subscriptionPlan === 'TRIAL') {
      updateData.trialEndsAt = null;
      updateData.status = 'ACTIVE';
    }

    // If this is a paid plan, trigger Stripe billing
    if (plan.minMonthlyFee > 0 || plan.pricePerEmployee > 0) {
      if (!this.stripe) return this.prisma.company.update({ where: { id: companyId }, data: updateData });
      try {
        // Create/update Stripe subscription
        const customerId = company.stripeCustomerId || await this.createStripeCustomer(company);
        updateData.stripeCustomerId = customerId;
        updateData.stripeSubscriptionId = await this.createStripeSubscription(customerId, plan, dto.billingCycle || 'MONTHLY');
      } catch (e: any) {
        // Log but don't fail - allow local operation without Stripe
        this.logger.warn('Stripe operation failed: ' + e.message);
      }
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });
  }

  // ======================================================================
  // Invoices
  // ======================================================================

  async getMyInvoices(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateInvoice(companyId: string, description: string, amount: number) {
    const count = await this.prisma.invoice.count({ where: { companyId } });
    const invoiceNumber = `INV-${companyId.slice(0, 6).toUpperCase()}-${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        description,
        amount,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }

  async markInvoicePaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  // ======================================================================
  // Feature Flags
  // ======================================================================

  async createFeatureFlag(dto: CreateFeatureFlagDto) {
    return this.prisma.featureFlag.create({ data: dto });
  }

  async findAllFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { name: 'asc' } });
  }

  async getCompanyFeatureFlags(companyId: string) {
    // Get all flags that are either global or have company overrides
    const allFlags = await this.prisma.featureFlag.findMany({
      orderBy: { name: 'asc' },
    });
    const companyOverrides = await this.prisma.companyFeatureFlag.findMany({
      where: { companyId },
      include: { featureFlag: true },
    });

    const overrideMap = new Map(companyOverrides.map(cf => [cf.featureFlag.code, cf.isEnabled]));

    return allFlags.map(ff => ({
      ...ff,
      // Global flags default to enabled; non-global default to disabled unless overridden
      isEnabled: ff.isGlobal
        ? (overrideMap.has(ff.code) ? overrideMap.get(ff.code)! : true)
        : (overrideMap.has(ff.code) ? overrideMap.get(ff.code)! : false),
    }));
  }

  async toggleFeatureFlag(companyId: string, featureFlagId: string, dto: ToggleFeatureFlagDto) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id: featureFlagId } });
    if (!flag) throw new NotFoundException('Feature flag not found.');

    return this.prisma.companyFeatureFlag.upsert({
      where: { companyId_featureFlagId: { companyId, featureFlagId } },
      update: { isEnabled: dto.isEnabled },
      create: { companyId, featureFlagId, isEnabled: dto.isEnabled },
    });
  }

  // ======================================================================
  // Custom Branding
  // ======================================================================

  async getCompanyBranding(companyId: string) {
    return this.prisma.companyBranding.findUnique({ where: { companyId } });
  }

  async updateCompanyBranding(companyId: string, dto: UpdateCompanyBrandingDto) {
    const existing = await this.prisma.companyBranding.findUnique({ where: { companyId } });
    if (existing) {
      return this.prisma.companyBranding.update({ where: { companyId }, data: dto });
    }
    return this.prisma.companyBranding.create({ data: { companyId, ...dto } });
  }

  // ======================================================================
  // Trial Enforcement
  // ======================================================================

  async checkTrialStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    if (company.subscriptionPlan !== 'TRIAL') {
      return { isTrial: false, daysRemaining: null, expired: false };
    }

    if (!company.trialEndsAt) {
      return { isTrial: true, daysRemaining: 14, expired: false };
    }

    const now = new Date();
    const daysRemaining = Math.ceil((company.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      // Auto-expire trial
      await this.prisma.company.update({
        where: { id: companyId },
        data: { status: 'TRIAL_EXPIRED' },
      });
      return { isTrial: true, daysRemaining: 0, expired: true };
    }

    return { isTrial: true, daysRemaining, expired: false };
  }

  // ======================================================================
  // Employee Limit Check
  // ======================================================================

  async checkEmployeeLimit(companyId: string): Promise<{ allowed: boolean; max: number; current: number }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { billingPlan: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const max = company.billingPlan?.maxEmployees ?? 10;
    const current = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, status: { not: 'TERMINATED' } },
    });

    return { allowed: current <= max, max, current };
  }

  // ======================================================================
  // Stripe Helpers
  // ======================================================================

  private async createStripeCustomer(company: any): Promise<string> {
    if (!this.stripe) return '';
    const customer = await this.stripe.customers.create({
      name: company.name,
      email: company.billingEmail || undefined,
      metadata: { companyId: company.id },
    });
    // Store customer ID on company
    await this.prisma.company.update({
      where: { id: company.id },
      data: { stripeCustomerId: customer.id } as any,
    });
    return customer.id;
  }

  private async createStripeSubscription(customerId: string, plan: any, cycle: string): Promise<string> {
    if (!this.stripe) return '';
    const priceId = cycle === 'YEARLY' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
    if (!priceId) return '';

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: { planId: plan.id },
    });
    return subscription.id;
  }

  // ======================================================================
  // Webhook handler for Stripe events
  // ======================================================================

  async handleStripeWebhook(event: any) {
    if (!this.stripe) return { received: true };

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const companyId = invoice.metadata?.companyId;
        if (companyId) {
          await this.prisma.invoice.upsert({
            where: { stripeInvoiceId: invoice.id } as any,
            update: { status: 'PAID', paidAt: new Date() },
            create: {
              companyId,
              invoiceNumber: `STRIPE-${invoice.number || Date.now()}`,
              amount: invoice.total / 100,
              status: 'PAID',
              stripeInvoiceId: invoice.id,
              paidAt: new Date(),
            } as any,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Handle subscription changes
        break;
      }
    }

    return { received: true };
  }
}
