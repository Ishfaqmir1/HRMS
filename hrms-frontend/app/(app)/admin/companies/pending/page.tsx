'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle2, XCircle, Clock, Building2, Mail, Globe, Users,
  Search, Shield, ExternalLink, CalendarDays, FileText,
} from 'lucide-react';
import Link from 'next/link';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface PendingCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string | null;
  isActive: boolean;
  createdAt: string;
  logoUrl: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  phone: string | null;
  billingPlan: { id: string; name: string; slug: string; maxEmployees: number; maxStorageGB: number } | null;
  employeeCount: number;
  userCount: number;
  owner: {
    id: string;
    email: string;
    status: string;
    lastLoginAt: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ──────────────────────────────────────────────────────────────────
// Reject Dialog
// ──────────────────────────────────────────────────────────────────

function RejectDialog({
  open, onClose, companyName, onConfirm, isLoading,
}: {
  open: boolean; onClose: () => void; companyName: string;
  onConfirm: (reason: string) => void; isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle size={18} className="text-danger" />
            Reject {companyName}
          </DialogTitle>
          <DialogDescription>
            Provide a reason for rejection. This will be sent to the company owner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink mb-1.5 block">Rejection Reason</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 transition-all duration-200"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Business information does not match submitted documents..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            isLoading={isLoading}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            <XCircle size={14} className="mr-1.5" />
            Reject Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminPendingApprovalsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PendingCompany | null>(null);

  // ── Fetch pending companies ──
  const { data: pendingCompanies = [], isLoading } = useQuery({
    queryKey: ['admin', 'pending-approvals'],
    queryFn: () => unwrap<PendingCompany[]>(api.get('/companies/pending/approvals')),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // ── Approve mutation ──
  const approveMut = useMutation({
    mutationFn: (companyId: string) => api.post(`/companies/${companyId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  // ── Reject mutation ──
  const rejectMut = useMutation({
    mutationFn: ({ companyId, reason }: { companyId: string; reason: string }) =>
      api.post(`/companies/${companyId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setRejectTarget(null);
    },
  });

  // ── Filter ──
  const filtered = pendingCompanies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase()) ||
    c.owner?.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Company Verification</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Pending Approvals</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Review and approve or reject new company registrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5">
            <Clock size={14} className="text-amber" />
            <span className="text-sm font-medium text-amber">
              {pendingCompanies.length} pending
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      {pendingCompanies.length > 0 && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search by company name, slug, or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      ) : filtered.length > 0 ? (
        /* Company Cards */
        <div className="space-y-4">
          {filtered.map((company) => (
            <div
              key={company.id}
              className="group relative rounded-2xl border border-border/60 bg-white transition-all duration-200 hover:shadow-md hover:border-accent/20"
            >
              <div className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Company Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Logo/Avatar */}
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10">
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        <span className="text-lg font-semibold text-accent">
                          {getInitials(company.name)}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-lg font-semibold text-ink">{company.name}</h3>
                        <Badge tone="warning" className="text-[10px]">
                          <Clock size={10} className="mr-0.5" /> Pending
                        </Badge>
                        <span className="text-xs text-ink-faint font-mono">{company.slug}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-ink-soft">
                        {company.owner && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-ink-faint" />
                            {company.owner.email}
                          </span>
                        )}
                        {company.industry && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-ink-faint" />
                            {company.industry}
                          </span>
                        )}
                        {company.country && (
                          <span className="flex items-center gap-1">
                            <Globe size={12} className="text-ink-faint" />
                            {company.country}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} className="text-ink-faint" />
                          Registered {fmtRelative(company.createdAt)}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-ink-faint">
                          <Users size={12} /> {company.employeeCount} employees
                        </span>
                        {company.billingPlan && (
                          <span className="flex items-center gap-1 text-ink-faint">
                            <FileText size={12} /> {company.billingPlan.name}
                          </span>
                        )}
                        {company.owner?.lastLoginAt && (
                          <span className="flex items-center gap-1 text-ink-faint">
                            Last login: {fmtRelative(company.owner.lastLoginAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/companies/${company.id}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink transition-colors"
                    >
                      <ExternalLink size={12} />
                      View Details
                    </Link>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                      onClick={() => setRejectTarget(company)}
                      isLoading={rejectMut.isPending && rejectMut.variables?.companyId === company.id}
                    >
                      <XCircle size={14} className="mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate(company.id)}
                      isLoading={approveMut.isPending && approveMut.variables === company.id}
                    >
                      <CheckCircle2 size={14} className="mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="flex items-center gap-4 border-t border-border/40 px-6 py-2.5 bg-paper/30 rounded-b-2xl">
                <span className="text-[11px] text-ink-faint flex items-center gap-1">
                  <Mail size={11} /> Owner: {company.owner?.email || '—'}
                </span>
                {company.owner?.firstName && (
                  <span className="text-[11px] text-ink-faint">
                    {company.owner.firstName} {company.owner.lastName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/5 mb-4">
            <CheckCircle2 size={32} className="text-accent/60" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-ink">All Caught Up</h3>
          <p className="mt-1 text-sm text-ink-faint max-w-md">
            {search
              ? `No pending approvals match "${search}".`
              : 'There are no companies awaiting approval. New registrations will appear here.'}
          </p>
          {search && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <RejectDialog
          open={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          companyName={rejectTarget.name}
          onConfirm={(reason) => rejectMut.mutate({ companyId: rejectTarget.id, reason })}
          isLoading={rejectMut.isPending}
        />
      )}
    </div>
  );
}
