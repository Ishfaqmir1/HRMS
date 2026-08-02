import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import {
  CreateBillingPlanDto, UpdateBillingPlanDto, UpdateCompanySubscriptionDto,
  CreateFeatureFlagDto, ToggleFeatureFlagDto, UpdateCompanyBrandingDto,
  CreatePlanFeatureDto, UpdatePlanFeatureDto, UpdateFeatureMappingDto,
  AddPaymentMethodDto, UpdatePaymentMethodDto, UpdateBillingContactDto,
} from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: any = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private documentTemplatesService: DocumentTemplatesService,
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
    const plans = await this.prisma.billingPlan.findMany({
      where: { isActive: true, visibility: 'PUBLIC' },
      orderBy: { sortOrder: 'asc' },
      include: {
        featureMappings: {
          include: { feature: true },
          orderBy: { feature: { category: 'asc' } },
        },
      },
    });

    // Group features by category for each plan
    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      minMonthlyFee: plan.minMonthlyFee,
      pricePerEmployee: plan.pricePerEmployee,
      includedEmployees: plan.includedEmployees,
      maxEmployees: plan.maxEmployees,
      maxStorageGB: plan.maxStorageGB,
      annualDiscountPercent: plan.annualDiscountPercent,
      currency: plan.currency,
      sortOrder: plan.sortOrder,
      isActive: plan.isActive,
      yearlyPrice: plan.yearlyPrice,
      apiLimit: plan.apiLimit,
      prioritySupport: plan.prioritySupport,
      visibility: plan.visibility,
      // Categorized features: { category_name: [{ name, description, isEnabled }] }
      features: plan.featureMappings
        .filter(m => m.isEnabled && m.feature.isActive)
        .reduce<Record<string, Array<{ code: string; name: string; description: string | null; category: string }>>>((acc, m) => {
          const cat = m.feature.category;
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push({
            code: m.feature.code,
            name: m.feature.name,
            description: m.feature.description,
            category: m.feature.category,
          });
          return acc;
        }, {}),
      // Flat list of all enabled features for backward compat
      featureList: plan.featureMappings
        .filter(m => m.isEnabled && m.feature.isActive)
        .map(m => m.feature.name),
    }));
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

  /**
   * Generate a PDF invoice for download.
   */
  async downloadInvoicePdf(
    companyId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { lineItems: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found.');

    // Fetch branding for custom colors
    const branding = await this.prisma.companyBranding.findUnique({
      where: { companyId },
    });

    const brandingEnabled = branding?.enabled ?? false;
    const primaryColor = brandingEnabled && branding?.primaryColor ? branding.primaryColor : '#2563eb';
    const secondaryColor = brandingEnabled && branding?.secondaryColor ? branding.secondaryColor : '#1e40af';
    const companyLogoUrl = brandingEnabled ? branding?.logoUrl ?? null : null;

    // Determine invoice status label
    const statusLabels: Record<string, string> = {
      DRAFT: 'Draft',
      SENT: 'Sent',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
      REFUNDED: 'Refunded',
      CANCELLED_INVOICE: 'Cancelled',
    };

    const invoiceStatus = statusLabels[invoice.status] || invoice.status;
    const dueDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
    const createdDate = new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const paidDate = invoice.paidAt
      ? new Date(invoice.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    // Currency formatting helper
    const fmt = (amount: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(amount);

    // Build line items HTML
    const lineItemsRows = invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems
          .map(
            (li) => `
            <tr>
              <td>${li.description}</td>
              <td class="amt">${li.quantity}</td>
              <td class="amt">${fmt(li.unitPrice)}</td>
              <td class="amt">${fmt(li.amount)}</td>
            </tr>`,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">
            ${invoice.description || `Invoice for ${invoice.invoiceNumber}`}
          </td>
        </tr>`;

    // Build the HTML invoice template
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    line-height: 1.6;
    background: #fff;
  }
  .page { max-width: 210mm; margin: 0 auto; padding: 30px 35px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 3px solid ${primaryColor};
    margin-bottom: 28px;
  }
  .header .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .header .brand-logo {
    width: 44px;
    height: 44px;
    object-fit: contain;
    border-radius: 8px;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 800;
    color: ${primaryColor};
    letter-spacing: -0.5px;
    margin: 0;
  }
  .header .company-name {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
  }
  .header .invoice-badge {
    text-align: right;
  }
  .header .invoice-badge .badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${invoice.status === 'PAID' ? '#05966920' : invoice.status === 'OVERDUE' ? '#dc262620' : '#f1f5f9'};
    color: ${invoice.status === 'PAID' ? '#059669' : invoice.status === 'OVERDUE' ? '#dc2626' : '#64748b'};
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 20px;
    margin-bottom: 28px;
  }
  .info-grid .box {
    background: #f8fafc;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e2e8f0;
  }
  .info-grid .box .label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .info-grid .box .value {
    font-weight: 600;
    color: #1a1a2e;
    font-size: 13px;
  }
  .info-grid .box .sub {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th {
    text-align: left;
    padding: 10px 14px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #64748b;
    background: #f1f5f9;
    border-bottom: 2px solid #e2e8f0;
  }
  td { padding: 9px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  td.amt { text-align: right; font-weight: 500; }
  th.amt { text-align: right; }
  tr.total td {
    border-top: 2px solid ${primaryColor};
    font-weight: 700;
    font-size: 13px;
    background: ${primaryColor}12;
  }
  tr.total td.amt { color: ${primaryColor}; }
  .total-box {
    margin-left: auto;
    width: 280px;
    background: #f8fafc;
    border-radius: 8px;
    padding: 16px 20px;
    border: 1px solid #e2e8f0;
  }
  .total-box .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 11px;
  }
  .total-box .row.label { color: #64748b; }
  .total-box .grand-total {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 10px;
    border-top: 2px solid ${primaryColor};
    font-size: 15px;
    font-weight: 700;
    color: ${primaryColor};
  }
  .payment-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 20px;
    margin-bottom: 20px;
    font-size: 12px;
    font-weight: 600;
    background: ${invoice.status === 'PAID' ? '#05966912' : invoice.status === 'OVERDUE' ? '#dc262612' : '#f8fafc'};
    border: 1px solid ${invoice.status === 'PAID' ? '#05966930' : invoice.status === 'OVERDUE' ? '#dc262630' : '#e2e8f0'};
    color: ${invoice.status === 'PAID' ? '#059669' : invoice.status === 'OVERDUE' ? '#dc2626' : '#64748b'};
  }
  .footer {
    margin-top: 30px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;
  }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: ${primaryColor};
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      ${
        companyLogoUrl
          ? `<img src="${companyLogoUrl}" alt="Logo" class="brand-logo" />`
          : ''
      }
      <div>
        <h1>INVOICE</h1>
        <p class="company-name">${company.name}</p>
        <p style="font-size:10px;color:#94a3b8;margin-top:2px;">${company.addressLine1 || ''}${company.city ? ', ' + company.city : ''}</p>
      </div>
    </div>
    <div class="invoice-badge">
      <div class="badge">${invoiceStatus}</div>
      <p style="font-size:11px;color:#64748b;margin-top:6px;">${invoice.invoiceNumber}</p>
    </div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div class="box">
      <div class="label">Bill To</div>
      <div class="value">${company.name}</div>
      <div class="sub">${company.billingEmail || company.phone || ''}</div>
      <div class="sub">${company.addressLine1 || ''}${company.city ? ', ' + company.city : ''}${company.country ? ', ' + company.country : ''}</div>
      ${company.gstNumber ? `<div class="sub" style="margin-top:4px;">GST: ${company.gstNumber}</div>` : ''}
      ${company.panNumber ? `<div class="sub">PAN: ${company.panNumber}</div>` : ''}
    </div>
    <div class="box">
      <div class="label">Invoice Details</div>
      <div class="sub"><strong>Date:</strong> ${createdDate}</div>
      <div class="sub"><strong>Due Date:</strong> ${dueDate}</div>
      ${paidDate ? `<div class="sub"><strong>Paid On:</strong> ${paidDate}</div>` : ''}
      <div class="sub"><strong>Currency:</strong> ${invoice.currency || 'USD'}</div>
    </div>
  </div>

  <!-- Line Items Table -->
  <div class="section-title">Invoice Items</div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="amt">Qty</th>
        <th class="amt">Unit Price</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
    </tbody>
  </table>

  <!-- Total -->
  <div class="total-box">
    <div class="row">
      <span>Subtotal</span>
      <span>${fmt(invoice.amount)}</span>
    </div>
    <div class="row">
      <span>Tax</span>
      <span>${fmt(0)}</span>
    </div>
    <div class="grand-total">
      <span>Total Due</span>
      <span>${fmt(invoice.amount)}</span>
    </div>
  </div>

  <!-- Payment Status Banner -->
  <div class="payment-status">
    <span style="font-size:16px;">${invoice.status === 'PAID' ? '✓' : invoice.status === 'OVERDUE' ? '!' : '•'}</span>
    ${invoice.status === 'PAID'
      ? `Payment received on ${paidDate || createdDate}`
      : invoice.status === 'OVERDUE'
      ? `Payment is overdue — please remit ${fmt(invoice.amount)} by the due date`
      : `Status: ${invoiceStatus} — Payment of ${fmt(invoice.amount)} is due by ${dueDate}`}
  </div>

  <div class="footer">
    <span>${company.name} &bull; ${company.phone || ''} ${company.billingEmail ? '&bull; ' + company.billingEmail : ''}</span>
    <span>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
  </div>
</div>
</body>
</html>`;

    const buffer = await this.documentTemplatesService.generatePdf(html);
    const filename = `invoice-${invoice.invoiceNumber.toLowerCase()}.pdf`;

    this.logger.log(`Invoice PDF generated: ${filename} for company ${companyId}`);
    return { buffer, filename, contentType: 'application/pdf' };
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
  // Plan Feature Catalog
  // ======================================================================

  async createFeature(dto: CreatePlanFeatureDto) {
    return this.prisma.planFeature.create({ data: dto });
  }

  async findAllFeatures() {
    return this.prisma.planFeature.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findAllFeaturesAdmin() {
    return this.prisma.planFeature.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOneFeature(id: string) {
    const feature = await this.prisma.planFeature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found.');
    return feature;
  }

  async updateFeature(id: string, dto: UpdatePlanFeatureDto) {
    await this.findOneFeature(id);
    return this.prisma.planFeature.update({ where: { id }, data: dto });
  }

  async removeFeature(id: string) {
    await this.findOneFeature(id);
    return this.prisma.planFeature.update({ where: { id }, data: { isActive: false } });
  }

  // ======================================================================
  // Plan-Feature Mappings
  // ======================================================================

  async updateFeatureMapping(planId: string, featureId: string, dto: UpdateFeatureMappingDto) {
    await this.findOnePlan(planId);
    await this.findOneFeature(featureId);

    return this.prisma.planFeatureMapping.upsert({
      where: { planId_featureId: { planId, featureId } },
      update: { isEnabled: dto.isEnabled },
      create: { planId, featureId, isEnabled: dto.isEnabled },
    });
  }

  async getPlanFeatureMappings(planId: string) {
    await this.findOnePlan(planId);
    return this.prisma.planFeatureMapping.findMany({
      where: { planId },
      include: { feature: true },
      orderBy: { feature: { category: 'asc' } },
    });
  }

  /**
   * Get all features with their enabled/disabled status for a given plan.
   * Features without explicit mappings default to disabled.
   */
  async getPlanFeaturesWithDefaults(planId: string) {
    await this.findOnePlan(planId);
    const allFeatures = await this.prisma.planFeature.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    const mappings = await this.prisma.planFeatureMapping.findMany({
      where: { planId },
    });
    const mappingMap = new Map(mappings.map(m => [m.featureId, m.isEnabled]));

    return allFeatures.map(f => ({
      ...f,
      isEnabled: mappingMap.get(f.id) ?? false,
      mappingId: mappings.find(m => m.featureId === f.id)?.id ?? null,
    }));
  }

  /**
   * Enable multiple features for a plan at once (bulk update).
   */
  async bulkUpdateFeatureMappings(planId: string, mappings: Array<{ featureId: string; isEnabled: boolean }>) {
    await this.findOnePlan(planId);

    // Validate all features exist
    const featureIds = mappings.map(m => m.featureId);
    const existingFeatures = await this.prisma.planFeature.findMany({
      where: { id: { in: featureIds } },
    });
    if (existingFeatures.length !== featureIds.length) {
      throw new NotFoundException('One or more features not found.');
    }

    // Bulk upsert all mappings
    const operations = mappings.map(m =>
      this.prisma.planFeatureMapping.upsert({
        where: { planId_featureId: { planId, featureId: m.featureId } },
        update: { isEnabled: m.isEnabled },
        create: { planId, featureId: m.featureId, isEnabled: m.isEnabled },
      }),
    );

    await this.prisma.$transaction(operations);
    return this.getPlanFeaturesWithDefaults(planId);
  }

  // ======================================================================
  // Payment Methods
  // ======================================================================

  async getPaymentMethods(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addPaymentMethod(companyId: string, dto: AddPaymentMethodDto) {
    // If this is the first card, or marked as default, unset other defaults
    const existingCount = await this.prisma.paymentMethod.count({
      where: { companyId, isActive: true },
    });

    const shouldBeDefault = dto.isDefault ?? existingCount === 0;

    if (shouldBeDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const paymentMethod = await this.prisma.paymentMethod.create({
      data: {
        companyId,
        brand: dto.brand,
        last4: dto.last4,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        cardholderName: dto.cardholderName,
        billingAddress1: dto.billingAddress1,
        billingAddress2: dto.billingAddress2,
        billingCity: dto.billingCity,
        billingState: dto.billingState,
        billingPostalCode: dto.billingPostalCode,
        billingCountry: dto.billingCountry,
        isDefault: shouldBeDefault,
      },
    });

    // Log audit event
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'PAYMENT_METHOD_ADDED',
        entityType: 'PaymentMethod',
        entityId: paymentMethod.id,
        metadata: { brand: dto.brand, last4: dto.last4, isDefault: shouldBeDefault },
      },
    });

    this.logger.log(`Payment method added for company ${companyId}: ${dto.brand} ending in ${dto.last4}`);
    return paymentMethod;
  }

  async updatePaymentMethod(companyId: string, paymentMethodId: string, dto: UpdatePaymentMethodDto) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, companyId, isActive: true },
    });
    if (!method) throw new NotFoundException('Payment method not found.');

    // If setting as default, unset other defaults first
    if (dto.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { companyId, isDefault: true, id: { not: paymentMethodId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: dto,
    });

    // Log audit event
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'PAYMENT_METHOD_UPDATED',
        entityType: 'PaymentMethod',
        entityId: paymentMethodId,
        metadata: { ...dto },
      },
    });

    return updated;
  }

  async deletePaymentMethod(companyId: string, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, companyId, isActive: true },
    });
    if (!method) throw new NotFoundException('Payment method not found.');

    // Soft-delete
    const result = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isActive: false, isDefault: false },
    });

    // If the deleted card was default, assign a new default
    if (method.isDefault) {
      const nextCard = await this.prisma.paymentMethod.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (nextCard) {
        await this.prisma.paymentMethod.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    // Log audit event
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'PAYMENT_METHOD_DELETED',
        entityType: 'PaymentMethod',
        entityId: paymentMethodId,
        metadata: { brand: method.brand, last4: method.last4 },
      },
    });

    this.logger.log(`Payment method ${paymentMethodId} deleted for company ${companyId}`);
    return result;
  }

  async toggleAutoPay(companyId: string, autoPay: boolean) {
    // Persist auto-pay preference on the company record
    await this.prisma.company.update({
      where: { id: companyId },
      data: { autoPay },
    });

    // Log the setting change
    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: autoPay ? 'AUTO_PAY_ENABLED' : 'AUTO_PAY_DISABLED',
        entityType: 'Company',
        entityId: companyId,
      },
    });

    this.logger.log(`Auto-pay ${autoPay ? 'enabled' : 'disabled'} for company ${companyId}`);
    return { autoPay };
  }

  async getAutoPayStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { autoPay: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const hasPaymentMethod = await this.prisma.paymentMethod.findFirst({
      where: { companyId, isActive: true },
    });

    return {
      autoPay: company.autoPay ?? false,
      hasPaymentMethod: !!hasPaymentMethod,
    };
  }

  async updateBillingContact(companyId: string, dto: UpdateBillingContactDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');

    const updateData: any = {};
    if (dto.billingEmail !== undefined) updateData.billingEmail = dto.billingEmail;
    if (dto.gstNumber !== undefined) updateData.gstNumber = dto.gstNumber;
    if (dto.panNumber !== undefined) updateData.panNumber = dto.panNumber;
    if (dto.addressLine1 !== undefined) updateData.addressLine1 = dto.addressLine1;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.postalCode !== undefined) updateData.postalCode = dto.postalCode;

    if (Object.keys(updateData).length === 0) {
      return { message: 'No fields to update.' };
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });
  }

  async getBillingContact(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        billingEmail: true,
        gstNumber: true,
        panNumber: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        phone: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
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
