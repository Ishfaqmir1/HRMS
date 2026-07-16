'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, CreditCard, TrendingUp, Building2, Users,
  Activity, PieChart, Receipt, Clock, ArrowUpRight, ArrowDownRight,
  Sparkles, BarChart3, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import Link from 'next/link';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface BillingOverview {
  summary: {
    totalCompanies: number;
    companiesOnTrial: number;
    companiesOnPaid: number;
    companiesOnFree: number;
    totalMRR: number;
    totalAnnualRevenue: number;
    currentMonthRevenue: number;
    lastMonthRevenue: number;
    revenueGrowth: number;
    averageRevenuePerCompany: number;
    totalPaymentMethods: number;
    conversionRate: number;
  };
  companiesByPlan: Array<{ plan: string; count: number }>;
  billingCycles: { monthly: number; yearly: number };
  plans: Array<{
    id: string; name: string; slug: string;
    minMonthlyFee: number; pricePerEmployee: number;
    includedEmployees: number; maxEmployees: number;
    currency: string; companiesOnPlan: number;
  }>;
  recentInvoices: Array<{
    id: string; invoiceNumber: string; amount: number;
    currency: string; status: string; description: string | null;
    dueDate: string | null; paidAt: string | null;
    createdAt: string; companyName: string; companySlug: string;
  }>;
  invoiceSummary: {
    paid: number; pending: number; overdue: number; total: number;
  };
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
}

function fmtNumber(v: number): string {
  return new Intl.NumberFormat('en-US').format(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const INVOICE_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  PAID: 'success',
  SENT: 'warning',
  DRAFT: 'default',
  OVERDUE: 'danger',
  REFUNDED: 'warning',
  CANCELLED_INVOICE: 'default',
};

// ──────────────────────────────────────────────────────────────────
// Stat Card
// ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sublabel, color, trend }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sublabel?: string; color?: string;
  trend?: { label: string; up: boolean };
}) {
  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-faint uppercase tracking-wider">{label}</p>
            <p className={`font-serif text-2xl font-semibold ${color || 'text-ink'}`}>{value}</p>
            {sublabel && <p className="text-xs text-ink-faint">{sublabel}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/5`}>
            <Icon size={18} className={color || 'text-accent'} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1.5">
            {trend.up
              ? <ArrowUpRight size={14} className="text-accent" />
              : <ArrowDownRight size={14} className="text-danger" />
            }
            <span className={`text-xs font-medium ${trend.up ? 'text-accent' : 'text-danger'}`}>
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Horizontal Bar
// ──────────────────────────────────────────────────────────────────

function HorizontalBar({ label, value, max, color = 'bg-accent', suffix }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-ink-soft truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-paper/80 rounded-full overflow-hidden ring-1 ring-inset ring-border/30">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs font-medium text-ink">{value}{suffix ? ` ${suffix}` : ''}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminBillingOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'billing-overview'],
    queryFn: () => unwrap<BillingOverview>(api.get('/admin/billing/overview')),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bento-card"><div className="skeleton h-24 w-full" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="bento-card border-danger/20 bg-danger/5 p-8 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-danger/60" />
          <p className="text-sm font-medium text-danger">
            Could not load billing overview.
          </p>
        </div>
      </div>
    );
  }

  const { summary, companiesByPlan, billingCycles, plans, recentInvoices, invoiceSummary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <DollarSign size={16} className="text-accent" />
          <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Billing</span>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-ink">Billing Overview</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Platform-wide subscription revenue, invoices, and billing metrics
        </p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={DollarSign} label="Monthly Recurring Revenue"
          value={fmt(summary.totalMRR)} color="text-accent"
          trend={{ label: `${summary.revenueGrowth > 0 ? '+' : ''}${summary.revenueGrowth}% vs last month`, up: summary.revenueGrowth >= 0 }}
        />
        <StatCard
          icon={TrendingUp} label="Annual Run Rate"
          value={fmt(summary.totalAnnualRevenue)} color="text-accent"
          sublabel="projected from current MRR"
        />
        <StatCard
          icon={Activity} label="Avg Revenue/Company"
          value={fmt(summary.averageRevenuePerCompany)} color="text-ink"
          sublabel="per month"
        />
        <StatCard
          icon={CheckCircle2} label="Conversion Rate"
          value={`${summary.conversionRate}%`} color="text-accent"
          sublabel={`${summary.companiesOnPaid} paid of ${summary.totalCompanies} total`}
        />
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 p-3 text-center">
          <p className="text-[10px] text-ink-faint uppercase tracking-wider">Total Companies</p>
          <p className="font-serif text-lg font-semibold text-ink mt-0.5">{fmtNumber(summary.totalCompanies)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3 text-center">
          <p className="text-[10px] text-ink-faint uppercase tracking-wider">On Trial</p>
          <p className="font-serif text-lg font-semibold text-amber mt-0.5">{fmtNumber(summary.companiesOnTrial)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3 text-center">
          <p className="text-[10px] text-ink-faint uppercase tracking-wider">On Paid Plans</p>
          <p className="font-serif text-lg font-semibold text-accent mt-0.5">{fmtNumber(summary.companiesOnPaid)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3 text-center">
          <p className="text-[10px] text-ink-faint uppercase tracking-wider">On Free/Trial</p>
          <p className="font-serif text-lg font-semibold text-ink-faint mt-0.5">{fmtNumber(summary.companiesOnFree)}</p>
        </div>
      </div>

      {/* Plans & Invoices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plans Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard size={16} className="text-accent" />
              Plans & Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Companies by Plan */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider">Companies per Plan</p>
              {companiesByPlan.map((p) => {
                const max = Math.max(...companiesByPlan.map(x => x.count));
                return (
                  <HorizontalBar key={p.plan} label={p.plan} value={p.count} max={max} />
                );
              })}
            </div>

            {/* Billing Cycles */}
            <div className="border-t border-border/40 pt-4">
              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Billing Cycles</p>
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-[10px] text-ink-faint">Monthly</p>
                  <p className="font-serif text-lg font-semibold text-ink">{billingCycles.monthly}</p>
                </div>
                <div className="flex-1 rounded-xl border border-border/60 p-3 text-center">
                  <p className="text-[10px] text-ink-faint">Yearly</p>
                  <p className="font-serif text-lg font-semibold text-accent">{billingCycles.yearly}</p>
                </div>
              </div>
            </div>

            {/* Plan Details */}
            <div className="border-t border-border/40 pt-4">
              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Plan Details</p>
              <div className="space-y-2">
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{plan.name}</p>
                      <p className="text-[10px] text-ink-faint">
                        {plan.minMonthlyFee > 0 ? fmt(plan.minMonthlyFee) : `${fmt(plan.pricePerEmployee)}/emp`} · Up to {plan.maxEmployees.toLocaleString()} employees
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{plan.companiesOnPlan}</p>
                      <p className="text-[10px] text-ink-faint">companies</p>
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <p className="text-sm text-ink-faint text-center py-3">No plans defined.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt size={16} className="text-accent" />
                Recent Invoices (This Month)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone="success" className="text-[10px]">{invoiceSummary.paid} paid</Badge>
                <Badge tone="warning" className="text-[10px]">{invoiceSummary.pending} pending</Badge>
                {invoiceSummary.overdue > 0 && (
                  <Badge tone="danger" className="text-[10px]">{invoiceSummary.overdue} overdue</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentInvoices.slice(0, 15).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-paper/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-ink">{inv.invoiceNumber}</span>
                      <Badge tone={INVOICE_TONES[inv.status] || 'default'} className="text-[9px]">
                        {inv.status === 'CANCELLED_INVOICE' ? 'Cancelled' : inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-faint truncate">{inv.companyName}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-semibold text-ink">{fmt(inv.amount)}</p>
                    <p className="text-[10px] text-ink-faint">{fmtRelative(inv.createdAt)}</p>
                  </div>
                </div>
              ))}
              {recentInvoices.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-ink-faint">No invoices this month.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
