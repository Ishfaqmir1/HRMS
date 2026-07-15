'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Search, FileText, Activity, Building2, User, CalendarDays,
  ChevronLeft, ChevronRight, Filter, X, Clock, BarChart3,
  Shield, Users, CreditCard, KeyRound, Settings, AlertTriangle,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { email: string | null; name: string | null } | null;
  company: { id: string; name: string; slug: string } | null;
}

interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  last30DaysLogs: number;
  actionCounts: { action: string; count: number }[];
  entityTypeCounts: { entityType: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  activeCompaniesLast30Days: number;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getActionColor(action: string): 'success' | 'warning' | 'danger' | 'default' {
  if (action.includes('_CREATED') || action.includes('REGISTERED') || action.includes('VERIFIED') || action.includes('APPROVED') || action.includes('ACTIVATED') || action.includes('ENABLED')) return 'success';
  if (action.includes('_DELETED') || action.includes('REJECTED') || action.includes('CANCELLED') || action.includes('FAILED') || action.includes('SUSPENDED')) return 'danger';
  if (action.includes('_UPDATED') || action.includes('LOGIN') || action.includes('TOGGLED') || action.includes('DISABLED')) return 'warning';
  return 'default';
}

function getActionIcon(action: string) {
  if (action.includes('COMPANY') || action.includes('REGISTER')) return Building2;
  if (action.includes('USER') || action.includes('LOGIN') || action.includes('EMPLOYEE')) return User;
  if (action.includes('PAYMENT') || action.includes('INVOICE') || action.includes('BILLING') || action.includes('PLAN')) return CreditCard;
  if (action.includes('ROLE') || action.includes('PERMISSION') || action.includes('PASSWORD')) return KeyRound;
  if (action.includes('SETTING') || action.includes('BRANDING') || action.includes('FLAG')) return Settings;
  return Activity;
}

// ──────────────────────────────────────────────────────────────────
// Stat Card
// ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sublabel, color }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sublabel?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wider">{label}</p>
          <p className={`font-serif text-2xl font-semibold mt-0.5 ${color || 'text-ink'}`}>{value}</p>
          {sublabel && <p className="text-xs text-ink-faint mt-0.5">{sublabel}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color ? color.replace('text-', 'bg-').replace('ink', 'accent') + '/10' : 'bg-accent/10'}`}>
          <Icon size={16} className={color || 'text-accent'} />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Audit logs query
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page, search, actionFilter, entityFilter],
    queryFn: () => unwrap<any>(
      api.get('/admin/audit-logs', {
        params: { page, limit: 50, search: search || undefined, action: actionFilter || undefined, entityType: entityFilter || undefined },
      }),
    ),
    staleTime: 15_000,
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['admin', 'audit-log-stats'],
    queryFn: () => unwrap<AuditLogStats>(api.get('/admin/audit-logs/stats')),
    staleTime: 60_000,
  });

  // Action types for filter dropdown
  const { data: actions } = useQuery({
    queryKey: ['admin', 'audit-log-actions'],
    queryFn: () => unwrap<{ action: string; count: number }[]>(api.get('/admin/audit-logs/actions')),
    staleTime: 120_000,
  });

  const logs = data?.items ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 50, totalPages: 0 };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Audit</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Audit Log Explorer</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Browse all platform-wide activity with search and filtering
          </p>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard icon={FileText} label="Total Logs" value={stats.totalLogs.toLocaleString()} sublabel="all time" color="text-accent" />
          <StatCard icon={Activity} label="Today" value={stats.todayLogs.toLocaleString()} sublabel="last 24 hours" color="text-accent" />
          <StatCard icon={CalendarDays} label="30 Days" value={stats.last30DaysLogs.toLocaleString()} sublabel="rolling month" color="text-ink" />
          <StatCard icon={Building2} label="Active Companies" value={stats.activeCompaniesLast30Days.toLocaleString()} sublabel="last 30 days" color="text-ink" />
          <StatCard icon={BarChart3} label="Action Types" value={stats.actionCounts.length.toLocaleString()} sublabel="unique actions" />
          <StatCard icon={Shield} label="Entity Types" value={stats.entityTypeCounts.length.toLocaleString()} sublabel="tracked entities" />
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                placeholder="Search actions, users, companies..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter size={14} className="mr-1.5" />
                Filters
                {(actionFilter || entityFilter) && <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white font-medium">!</span>}
              </Button>
              {(search || actionFilter || entityFilter) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); setPage(1); }}>
                  <X size={14} className="mr-1" /> Clear
                </Button>
              )}
              <span className="text-xs text-ink-faint">{meta.total.toLocaleString()} entries</span>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-faint">Action:</span>
                <select
                  className="h-8 rounded-lg border border-input bg-white px-2.5 py-1 text-xs text-ink"
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All actions</option>
                  {(actions || []).map((a) => (
                    <option key={a.action} value={a.action}>{a.action} ({a.count})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-faint">Entity:</span>
                <select
                  className="h-8 rounded-lg border border-input bg-white px-2.5 py-1 text-xs text-ink"
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All entities</option>
                  {(stats?.entityTypeCounts || []).map((e) => (
                    <option key={e.entityType} value={e.entityType}>{e.entityType} ({e.count})</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : logs.length > 0 ? (
            <>
              <div className="divide-y divide-border">
                {logs.map((log: AuditLogEntry) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-paper/50 transition-colors">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/5">
                        <Icon size={14} className="text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone={getActionColor(log.action)} className="text-[10px] font-mono">
                            {log.action}
                          </Badge>
                          {log.entityType && (
                            <span className="text-xs text-ink-faint">{log.entityType}</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                          {log.user && <span>{log.user.name || log.user.email || 'System'}</span>}
                          {log.company && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Building2 size={10} />
                                {log.company.name}
                              </span>
                            </>
                          )}
                        </div>
                        {log.metadata && (
                          <p className="mt-0.5 text-xs text-ink-faint/60 font-mono truncate max-w-xl">
                            {JSON.stringify(log.metadata).substring(0, 120)}
                            {JSON.stringify(log.metadata).length > 120 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-ink-faint" title={fmtDateTime(log.createdAt)}>
                          {fmtRelative(log.createdAt)}
                        </span>
                        <span className="text-[10px] text-ink-faint/50">{fmtDate(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <p className="text-sm text-ink-faint">
                  Page {meta.page} of {Math.max(meta.totalPages, 1)} · {meta.total.toLocaleString()} total entries
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={14} /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity size={40} className="mb-3 text-ink-faint/40" />
              <p className="text-sm font-medium text-ink-faint">
                {search || actionFilter || entityFilter ? 'No audit logs match your filters.' : 'No audit logs yet.'}
              </p>
              {(search || actionFilter || entityFilter) && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Distribution */}
      {stats && stats.actionCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 size={16} className="text-accent" />
              Top Actions (All Time)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats.actionCounts.slice(0, 15).map((a) => {
                const maxCount = stats.actionCounts[0]?.count ?? 1;
                const pct = Math.round((a.count / maxCount) * 100);
                return (
                  <div key={a.action} className="flex items-center gap-4 px-6 py-3 hover:bg-paper/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <Badge tone={getActionColor(a.action)} className="text-[10px] font-mono">{a.action}</Badge>
                        <span className="text-xs font-semibold text-ink">{a.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-paper overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/60 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
