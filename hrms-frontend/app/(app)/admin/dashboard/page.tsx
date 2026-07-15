'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, statusTone } from '@/components/ui/badge';
import {
  Building2, Users, TrendingUp, DollarSign, Clock, UserCheck,
  Activity, Sparkles, Globe, CreditCard, FileText, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Shield, BarChart3,
} from 'lucide-react';
import Link from 'next/link';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface AdminDashboardMetrics {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredCompanies: number;
  suspendedCompanies: number;
  totalEmployees: number;
  activeEmployees: number;
  totalActiveUsers: number;
  usersLoggedInToday: number;
  newCompaniesThisWeek: number;
  monthlyRevenue: number;
  monthlyGrossPayroll: number;
  estimatedMRR: number;
  estimatedARR: number;
  topCompaniesByEmployees: Array<{
    id: string; name: string; slug: string; status: string;
    plan: string; employeeCount: number;
  }>;
  topCompaniesByUsers: Array<{
    id: string; name: string; slug: string; userCount: number;
  }>;
  latestRegistrations: Array<{
    id: string; name: string; slug: string; status: string;
    plan: string; employeeCount: number;
    ownerEmail: string | null; ownerLastLogin: string | null;
    createdAt: string;
  }>;
  latestPayments: Array<{
    id: string; employeeName: string; employeeCode: string;
    companyName: string; netPay: number; grossPay: number;
    paidAt: string | null;
  }>;
  latestAuditLogs: Array<{
    id: string; action: string; entityType: string | null;
    userEmail: string | null; actor: string | null;
    createdAt: string;
  }>;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
}

function fmtNumber(v: number): string {
  return new Intl.NumberFormat('en-US').format(v);
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return fmtNumber(v);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ──────────────────────────────────────────────────────────────────
// Stat Card
// ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sublabel, trend, trendUp, color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sublabel?: string;
  trend?: string; trendUp?: boolean; color?: string;
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
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color ? color.replace('text-', 'bg-').replace('ink', 'accent') + '/10' : 'bg-accent/10'}`}>
            <Icon size={18} className={color || 'text-accent'} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1.5">
            {trendUp
              ? <ArrowUpRight size={14} className="text-accent" />
              : <ArrowDownRight size={14} className="text-danger" />
            }
            <span className={`text-xs font-medium ${trendUp ? 'text-accent' : 'text-danger'}`}>
              {trend}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => unwrap<AdminDashboardMetrics>(api.get('/admin/dashboard')),
    staleTime: 60 * 1000,     // 1 minute
    refetchInterval: 120 * 1000, // auto-refresh every 2 minutes
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bento-card"><div className="skeleton h-24 w-full" /></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bento-card"><div className="skeleton h-64 w-full" /></div>
          <div className="bento-card"><div className="skeleton h-64 w-full" /></div>
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
            Could not load the platform dashboard. Ensure you are logged in as a Super Admin.
          </p>
        </div>
      </div>
    );
  }

  const {
    totalCompanies, activeCompanies, trialCompanies, expiredCompanies, suspendedCompanies,
    totalEmployees, activeEmployees, totalActiveUsers, usersLoggedInToday,
    newCompaniesThisWeek, monthlyRevenue, estimatedMRR, estimatedARR,
  } = data;

  const revenuePerEmployee = totalEmployees > 0
    ? Math.round(estimatedMRR / totalEmployees)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Overview</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-ink-faint">
            SaaS platform health · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/companies" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink transition-colors">
            <Building2 size={14} />
            Manage Companies
          </Link>
        </div>
      </div>

      {/* ── Core Metrics Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard icon={Building2} label="Total Companies" value={fmtNumber(totalCompanies)} sublabel={`${activeCompanies} active`} color="text-accent" />
        <StatCard icon={Users} label="Total Employees" value={fmtCompact(totalEmployees)} sublabel={`${fmtCompact(activeEmployees)} active`} color="text-ink" />
        <StatCard icon={UserCheck} label="Active Users" value={fmtNumber(totalActiveUsers)} sublabel={`${usersLoggedInToday} logged in today`} color="text-accent" />
        <StatCard icon={Clock} label="Trial Companies" value={fmtNumber(trialCompanies)} sublabel={`${expiredCompanies} expired`} color={trialCompanies > 0 ? 'text-amber' : 'text-ink-faint'} />
        <StatCard icon={TrendingUp} label="New This Week" value={fmtNumber(newCompaniesThisWeek)} sublabel="new companies registered" trend={newCompaniesThisWeek > 0 ? `+${newCompaniesThisWeek} this week` : undefined} trendUp color="text-accent" />
        <StatCard icon={Shield} label="Suspended" value={fmtNumber(suspendedCompanies)} sublabel="companies suspended" color={suspendedCompanies > 0 ? 'text-danger' : 'text-ink-faint'} />
      </div>

      {/* ── Revenue Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={DollarSign} label="Monthly Revenue" value={fmtCurrency(monthlyRevenue)} sublabel="from completed payroll runs" color="text-accent" />
        <StatCard icon={CreditCard} label="Estimated MRR" value={fmtCurrency(estimatedMRR)} sublabel={`~${fmtCurrency(revenuePerEmployee)}/emp`} color="text-accent" />
        <StatCard icon={TrendingUp} label="Estimated ARR" value={fmtCurrency(estimatedARR)} sublabel="projected annual run rate" color="text-accent" />
        <StatCard icon={Activity} label="Rev/Employee" value={fmtCurrency(revenuePerEmployee)} sublabel="average per employee" color="text-ink" />
      </div>

      {/* ── Top Companies & Latest Activity ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 10 Companies by Employees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 size={16} className="text-accent" /> Top Companies by Employees
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.topCompaniesByEmployees.slice(0, 8).map((company, idx) => (
                <div key={company.id} className="flex items-center justify-between px-6 py-3 hover:bg-paper/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/companies?id=${company.id}`} className="text-sm font-medium text-ink hover:text-accent truncate block">
                        {company.name}
                      </Link>
                      <span className="text-xs text-ink-faint">{company.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge tone={statusTone(company.status)} className="text-[10px]">{company.status}</Badge>
                    <span className="text-sm font-semibold text-ink">{company.employeeCount}</span>
                  </div>
                </div>
              ))}
              {data.topCompaniesByEmployees.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-ink-faint">No companies registered yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe size={16} className="text-accent" /> Latest Company Registrations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.latestRegistrations.slice(0, 8).map((company) => (
                <div key={company.id} className="flex items-center justify-between px-6 py-3 hover:bg-paper/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/companies?id=${company.id}`} className="text-sm font-medium text-ink hover:text-accent truncate">
                        {company.name}
                      </Link>
                      <Badge tone={statusTone(company.status)} className="text-[10px]">{company.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-faint">
                      {company.ownerEmail || '—'} · {fmtRelative(company.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint flex-shrink-0">{company.plan}</span>
                </div>
              ))}
              {data.latestRegistrations.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-ink-faint">No registrations yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Activity Feeds ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Latest Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign size={16} className="text-accent" /> Latest Payslips (Payments)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.latestPayments.slice(0, 6).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between px-6 py-3 hover:bg-paper/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{payment.employeeName}</p>
                    <p className="text-xs text-ink-faint">
                      {payment.companyName} · {payment.employeeCode}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-accent">{fmtCurrency(payment.netPay)}</p>
                    <p className="text-[10px] text-ink-faint">{fmtRelative(payment.paidAt)}</p>
                  </div>
                </div>
              ))}
              {data.latestPayments.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-ink-faint">No payments recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText size={16} className="text-accent" /> Latest Activity (Audit Logs)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.latestAuditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-paper/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      <span className="font-mono text-xs text-accent">{log.action}</span>
                    </p>
                    <p className="text-xs text-ink-faint">
                      {log.actor || log.userEmail || 'System'} · {log.entityType || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint flex-shrink-0">{fmtRelative(log.createdAt)}</span>
                </div>
              ))}
              {data.latestAuditLogs.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-ink-faint">No audit logs yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Action Bar ────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-accent via-accent to-accent-hover p-6 text-white shadow-lg shadow-accent/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Platform Quick Actions</p>
            <p className="text-sm text-white/70">Manage your SaaS platform from one place</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/companies"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
            >
              <Building2 size={14} /> Companies
            </Link>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
            >
              <CreditCard size={14} /> Billing
            </Link>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
            >
              <BarChart3 size={14} /> Analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


