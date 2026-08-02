'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, TrendingUp, Building2, Users, Activity, PieChart,
  CreditCard, Clock, Shield,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface AdminAnalytics {
  summary: {
    totalCompanies: number;
    totalEmployees: number;
    activeEmployees: number;
    companiesOnTrial: number;
    companiesOnPaid: number;
    pendingApprovals: number;
    suspendedCompanies: number;
  };
  registrationsByMonth: Array<{ month: number; label: string; count: number }>;
  employeeGrowth: Array<{ month: number; label: string; count: number }>;
  companiesByPlan: Array<{ plan: string; count: number }>;
  companiesByStatus: Array<{ status: string; count: number }>;
  companiesByIndustry: Array<{ industry: string; count: number }>;
  payrollThisMonth: {
    totalPayrolls: number;
    totalNet: number;
    totalGross: number;
    totalEmployeesPaid: number;
  };
  topCompanies: Array<{
    id: string; name: string; slug: string; status: string;
    plan: string; employeeCount: number; userCount: number;
  }>;
  currentYear: number;
  currentMonth: number;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtNumber(v: number): string {
  return new Intl.NumberFormat('en-US').format(v);
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return fmtNumber(v);
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-accent',
  PENDING_APPROVAL: 'bg-amber',
  SUSPENDED: 'bg-danger',
  TRIAL: 'bg-blue',
  CANCELLED: 'bg-gray',
  REJECTED: 'bg-danger',
  PENDING_EMAIL_VERIFICATION: 'bg-amber',
};

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  TRIAL: 'warning',
  CANCELLED: 'danger',
  REJECTED: 'danger',
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

function HorizontalBar({ label, value, max, color }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-ink-soft truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-paper/80 rounded-full overflow-hidden ring-1 ring-inset ring-border/30">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color || 'bg-accent'}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium text-ink">{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Simple Bar Chart (CSS-only)
// ──────────────────────────────────────────────────────────────────

function SimpleBarChart({ data, maxValue, color = 'bg-accent' }: {
  data: Array<{ label: string; count: number }>;
  maxValue?: number;
  color?: string;
}) {
  const max = maxValue ?? Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => {
        const height = Math.max(4, (d.count / max) * 100);
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] font-medium text-ink opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </span>
            <div
              className={`w-full rounded-t transition-all duration-300 ${color} opacity-80 hover:opacity-100`}
              style={{ height: `${height}%`, minHeight: d.count > 0 ? '4px' : '0' }}
            />
            <span className="text-[9px] text-ink-faint truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => unwrap<AdminAnalytics>(api.get('/admin/analytics')),
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
          <Activity size={32} className="mx-auto mb-3 text-danger/60" />
          <p className="text-sm font-medium text-danger">
            Could not load platform analytics.
          </p>
        </div>
      </div>
    );
  }

  const {
    summary, registrationsByMonth, employeeGrowth,
    companiesByPlan, companiesByStatus, companiesByIndustry,
    payrollThisMonth, topCompanies,
  } = data;

  const revenuePerEmployee = summary.totalEmployees > 0
    ? Math.round(payrollThisMonth.totalNet / summary.totalEmployees)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <BarChart3 size={16} className="text-accent" />
          <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Analytics</span>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Platform-wide metrics and trends for {data.currentYear}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Building2} label="Total Companies" value={fmtNumber(summary.totalCompanies)} color="text-accent" />
        <StatCard icon={Users} label="Total Employees" value={fmtCompact(summary.totalEmployees)} sublabel={`${fmtCompact(summary.activeEmployees)} active`} color="text-ink" />
        <StatCard icon={CreditCard} label="On Paid Plans" value={fmtNumber(summary.companiesOnPaid)} sublabel={`${summary.companiesOnTrial} on trial`} color="text-accent" />
        <StatCard icon={Clock} label="Pending Approval" value={fmtNumber(summary.pendingApprovals)} color={summary.pendingApprovals > 0 ? 'text-amber' : 'text-ink-faint'} />
        <StatCard icon={Shield} label="Suspended" value={fmtNumber(summary.suspendedCompanies)} color={summary.suspendedCompanies > 0 ? 'text-danger' : 'text-ink-faint'} />
        <StatCard icon={TrendingUp} label="Payroll This Month" value={fmtCurrency(payrollThisMonth.totalNet)} sublabel={`${payrollThisMonth.totalEmployeesPaid} employees paid`} color="text-accent" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={16} className="text-accent" />
              Company Registrations by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={registrationsByMonth} color="bg-accent" />
          </CardContent>
        </Card>

        {/* Employee Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={16} className="text-accent" />
              Employee Growth by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={employeeGrowth} color="bg-blue" />
          </CardContent>
        </Card>
      </div>

      {/* Distribution Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Companies by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard size={14} className="text-accent" />
              Companies by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companiesByPlan.map((p) => {
                const max = Math.max(...companiesByPlan.map(x => x.count));
                return (
                  <HorizontalBar
                    key={p.plan}
                    label={p.plan}
                    value={p.count}
                    max={max}
                    color={p.plan === 'TRIAL' ? 'bg-amber' : 'bg-accent'}
                  />
                );
              })}
              {companiesByPlan.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Companies by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity size={14} className="text-accent" />
              Companies by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companiesByStatus.map((s) => {
                const max = Math.max(...companiesByStatus.map(x => x.count));
                return (
                  <HorizontalBar
                    key={s.status}
                    label={s.status.replace(/_/g, ' ')}
                    value={s.count}
                    max={max}
                    color={STATUS_COLORS[s.status] || 'bg-gray'}
                  />
                );
              })}
              {companiesByStatus.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Companies by Industry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart size={14} className="text-accent" />
              Companies by Industry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companiesByIndustry.slice(0, 10).map((ind) => {
                const max = Math.max(...companiesByIndustry.map(x => x.count));
                return (
                  <HorizontalBar
                    key={ind.industry}
                    label={ind.industry}
                    value={ind.count}
                    max={max}
                    color="bg-purple"
                  />
                );
              })}
              {companiesByIndustry.length === 0 && (
                <p className="text-sm text-ink-faint text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Companies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 size={16} className="text-accent" />
            Top Companies by Employees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {topCompanies.map((c, idx) => (
              <div key={c.id} className="flex items-center justify-between px-6 py-3 hover:bg-paper/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-ink truncate block">{c.name}</span>
                    <span className="text-xs text-ink-faint">{c.slug} · {c.plan}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge tone={STATUS_TONES[c.status] || 'default'} className="text-[10px]">{c.status}</Badge>
                  <span className="text-sm font-semibold text-ink">{c.employeeCount}</span>
                  <span className="text-xs text-ink-faint">employees</span>
                </div>
              </div>
            ))}
            {topCompanies.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-ink-faint">No companies yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payroll Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={16} className="text-accent" />
            Payroll Summary (This Month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/60 p-4 text-center">
              <p className="text-xs text-ink-faint uppercase tracking-wider">Total Payrolls</p>
              <p className="font-serif text-xl font-semibold text-ink mt-1">{fmtNumber(payrollThisMonth.totalPayrolls)}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 text-center">
              <p className="text-xs text-ink-faint uppercase tracking-wider">Gross Payroll</p>
              <p className="font-serif text-xl font-semibold text-accent mt-1">{fmtCurrency(payrollThisMonth.totalGross)}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 text-center">
              <p className="text-xs text-ink-faint uppercase tracking-wider">Net Payroll</p>
              <p className="font-serif text-xl font-semibold text-accent mt-1">{fmtCurrency(payrollThisMonth.totalNet)}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4 text-center">
              <p className="text-xs text-ink-faint uppercase tracking-wider">Employees Paid</p>
              <p className="font-serif text-xl font-semibold text-ink mt-1">{fmtNumber(payrollThisMonth.totalEmployeesPaid)}</p>
            </div>
          </div>
          {revenuePerEmployee > 0 && (
            <p className="text-xs text-ink-faint mt-4 text-center">
              Average payout per employee: <strong className="text-ink">{fmtCurrency(revenuePerEmployee)}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
