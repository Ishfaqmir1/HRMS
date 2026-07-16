import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBillingService {
  constructor(private prisma: PrismaService) {}

  async getBillingOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Run all queries in parallel ──────────────────────────
    const [
      allCompanies,
      allPlans,
      currentMonthInvoices,
      lastMonthInvoices,
      paymentMethodsCount,
    ] = await Promise.all([
      // All active companies with their billing info
      this.prisma.company.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionPlan: true,
          billingCycle: true,
          billingPlanId: true,
          trialEndsAt: true,
          isActive: true,
          createdAt: true,
          billingEmail: true,
          billingPlan: {
            select: {
              id: true,
              name: true,
              slug: true,
              minMonthlyFee: true,
              pricePerEmployee: true,
              includedEmployees: true,
              maxEmployees: true,
              currency: true,
            },
          },
          _count: { select: { employees: true, users: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // All billing plans
      this.prisma.billingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),

      // Current month invoices
      this.prisma.invoice.findMany({
        where: { createdAt: { gte: monthStart } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          currency: true,
          status: true,
          description: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true, slug: true } },
        },
      }),

      // Last month invoices (for comparison)
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          createdAt: { gte: lastMonthStart, lt: monthStart },
          status: 'PAID',
        },
      }),

      // Total payment methods
      this.prisma.paymentMethod.count({
        where: { isActive: true },
      }),
    ]);

    // ── Compute derived metrics ──────────────────────────────

    // Total MRR based on subscriptions
    let totalMRR = 0;
    let totalAnnualRevenue = 0;
    const companiesByPlan: Record<string, number> = {};
    const companiesByCycle: Record<string, number> = { monthly: 0, yearly: 0 };

    for (const company of allCompanies) {
      const plan = company.billingPlan;
      let monthlyCost = 0;

      if (plan) {
        if (plan.minMonthlyFee > 0) {
          monthlyCost = plan.minMonthlyFee;
        } else {
          monthlyCost = plan.pricePerEmployee * Math.max(0, company._count.employees - plan.includedEmployees);
        }
      }

      totalMRR += monthlyCost;

      if (company.billingCycle === 'YEARLY') {
        totalAnnualRevenue += monthlyCost * 12;
        companiesByCycle.yearly++;
      } else {
        companiesByCycle.monthly++;
      }

      const planName = plan?.name || company.subscriptionPlan || 'FREE';
      companiesByPlan[planName] = (companiesByPlan[planName] || 0) + 1;
    }

    const currentMonthRevenue = currentMonthInvoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const lastMonthRevenue = lastMonthInvoices._sum.amount ?? 0;

    const companiesOnTrial = allCompanies.filter((c) => c.subscriptionPlan === 'TRIAL').length;
    const companiesOnPaid = allCompanies.filter((c) => c.subscriptionPlan && c.subscriptionPlan !== 'TRIAL').length;
    const companiesOnFree = allCompanies.filter((c) => !c.subscriptionPlan || !['TRIAL', 'ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'REJECTED'].includes(c.subscriptionPlan)).length;

    return {
      summary: {
        totalCompanies: allCompanies.length,
        companiesOnTrial,
        companiesOnPaid,
        companiesOnFree,
        totalMRR: Math.round(totalMRR),
        totalAnnualRevenue: Math.round(totalAnnualRevenue),
        currentMonthRevenue: Math.round(currentMonthRevenue),
        lastMonthRevenue: Math.round(lastMonthRevenue),
        revenueGrowth: lastMonthRevenue > 0
          ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : 0,
        averageRevenuePerCompany: allCompanies.length > 0
          ? Math.round(totalMRR / allCompanies.length)
          : 0,
        totalPaymentMethods: paymentMethodsCount,
        conversionRate: allCompanies.length > 0
          ? Math.round((companiesOnPaid / allCompanies.length) * 100)
          : 0,
      },
      companiesByPlan: Object.entries(companiesByPlan)
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
      billingCycles: companiesByCycle,
      plans: allPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        minMonthlyFee: plan.minMonthlyFee,
        pricePerEmployee: plan.pricePerEmployee,
        includedEmployees: plan.includedEmployees,
        maxEmployees: plan.maxEmployees,
        currency: plan.currency,
        companiesOnPlan: allCompanies.filter((c) => c.billingPlanId === plan.id).length,
      })),
      recentInvoices: currentMonthInvoices.slice(0, 20).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        description: inv.description,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        companyName: inv.company?.name ?? '—',
        companySlug: inv.company?.slug ?? '—',
      })),
      invoiceSummary: {
        paid: currentMonthInvoices.filter((i) => i.status === 'PAID').length,
        pending: currentMonthInvoices.filter((i) => i.status === 'SENT' || i.status === 'DRAFT').length,
        overdue: currentMonthInvoices.filter((i) => i.status === 'OVERDUE').length,
        total: currentMonthInvoices.length,
      },
    };
  }
}
