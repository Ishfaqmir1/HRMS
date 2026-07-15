'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import {
  Company, CompanyDetail, CompanyUser, CompanyAuditLog,
  ImpersonateResult, PaginatedResult, BillingPlanSummary,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, statusTone } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { saveSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  Search, Building2, MoreHorizontal, ExternalLink, ShieldAlert,
  Trash2, KeyRound, Mail, CreditCard, Database, Users, FileText,
  Activity, RefreshCw, Ban, CheckCircle2, XCircle, ChevronLeft,
  ChevronRight, Globe, Clock, HardDrive, Package,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  TRIAL_EXPIRED: 'danger',
  SUSPENDED: 'danger',
  CANCELLED: 'danger',
  PENDING_EMAIL_VERIFICATION: 'default',
  PENDING_APPROVAL: 'warning',
  REJECTED: 'danger',
  PENDING: 'warning',
};

// ──────────────────────────────────────────────────────────────────
// Action Dialog Components
// ──────────────────────────────────────────────────────────────────

function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'destructive',
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'destructive' | 'default';
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} isLoading={isLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  open, onClose, companyId, onSuccess,
}: {
  open: boolean; onClose: () => void; companyId: string; onSuccess: () => void;
}) {
  const [password, setPassword] = useState('Temp123!');

  const mutation = useMutation({
    mutationFn: (newPassword: string) =>
      api.post(`/companies/${companyId}/reset-password`, { newPassword }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Owner Password</DialogTitle>
          <DialogDescription>
            Set a new password for the company owner. They will be asked to change it on next login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>New Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={mutation.isPending} onClick={() => mutation.mutate(password)}>
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementDialog({
  open, onClose, companyId, onSuccess,
}: {
  open: boolean; onClose: () => void; companyId: string; onSuccess: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: { subject: string; message: string; sendEmail: boolean }) =>
      api.post(`/companies/${companyId}/announcement`, data),
    onSuccess: () => { onSuccess(); onClose(); setSubject(''); setMessage(''); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Announcement</DialogTitle>
          <DialogDescription>Send an announcement to all users in this company.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Announcement subject" />
          </div>
          <div>
            <Label>Message</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your announcement..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded" />
            Also send via email
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!subject || !message}
            onClick={() => mutation.mutate({ subject, message, sendEmail })}
          >
            Send Announcement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangePlanDialog({
  open, onClose, companyId, onSuccess, currentPlan,
}: {
  open: boolean; onClose: () => void; companyId: string; onSuccess: () => void; currentPlan: string | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState('');

  const { data: plans } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => unwrap<BillingPlanSummary[]>(api.get('/billing/plans')),
  });

  const mutation = useMutation({
    mutationFn: (planId: string) =>
      api.patch(`/companies/${companyId}/plan`, { planId, billingCycle: 'MONTHLY' }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>
            Current plan: <strong>{currentPlan || 'None'}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(plans || []).map((plan) => (
            <div
              key={plan.id}
              className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors hover:bg-paper ${
                selectedPlan === plan.id ? 'border-accent bg-accent/5' : ''
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <div>
                <p className="font-medium text-ink">{plan.name}</p>
                <p className="text-xs text-ink-faint">
                  Up to {plan.maxEmployees.toLocaleString()} employees · {plan.maxStorageGB}GB storage
                </p>
              </div>
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border">
                {selectedPlan === plan.id && <div className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!selectedPlan}
            onClick={() => mutation.mutate(selectedPlan)}
          >
            Change Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateLimitsDialog({
  open, onClose, companyId, onSuccess,
}: {
  open: boolean; onClose: () => void; companyId: string; onSuccess: () => void;
}) {
  const [maxEmployees, setMaxEmployees] = useState('100');
  const [maxStorageGB, setMaxStorageGB] = useState('25');

  const mutation = useMutation({
    mutationFn: (data: { maxEmployees?: number; maxStorageGB?: number }) =>
      api.patch(`/companies/${companyId}/limits`, data),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Limits</DialogTitle>
          <DialogDescription>Override the employee or storage limits for this company.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Max Employees</Label>
            <Input
              type="number" value={maxEmployees}
              onChange={(e) => setMaxEmployees(e.target.value)}
              placeholder="100"
            />
          </div>
          <div>
            <Label>Max Storage (GB)</Label>
            <Input
              type="number" value={maxStorageGB}
              onChange={(e) => setMaxStorageGB(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate({
              maxEmployees: parseInt(maxEmployees) || undefined,
              maxStorageGB: parseInt(maxStorageGB) || undefined,
            })}
          >
            Update Limits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Company Detail Panel (slide-over)
// ──────────────────────────────────────────────────────────────────

function CompanyDetailPanel({
  company, onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['company', company.id],
    queryFn: () => unwrap<CompanyDetail>(api.get(`/companies/${company.id}`)),
  });

  // Users and audit logs can be loaded on-demand with a separate tab/navigation

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Building2 size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">{company.name}</h2>
              <p className="text-xs text-ink-faint">{company.slug}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink transition-colors">
            <XCircle size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Status & Plan */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-ink-faint">Status</p>
                  <Badge tone={STATUS_BADGE[detail.status] || 'default'} className="mt-1">
                    {detail.status}
                  </Badge>
                  {detail.trialEndsAt && (
                    <p className="mt-2 text-xs text-ink-faint">
                      Trial ends: {fmtDate(detail.trialEndsAt)}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-ink-faint">Plan</p>
                  <p className="mt-1 font-medium text-ink">
                    {detail.billingPlan?.name || detail.subscriptionPlan || '—'}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {detail.billingCycle}
                  </p>
                </div>
              </div>

              {/* Owner Info */}
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-2">Owner</p>
                {detail.owner ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-ink">
                      {detail.owner.firstName || detail.owner.lastName
                        ? `${detail.owner.firstName || ''} ${detail.owner.lastName || ''}`
                        : detail.owner.email}
                    </p>
                    <p className="text-xs text-ink-faint">{detail.owner.email}</p>
                    {detail.owner.phone && <p className="text-xs text-ink-faint">{detail.owner.phone}</p>}
                    <p className="text-xs text-ink-faint">
                      Last login: {fmtDateTime(detail.owner.lastLoginAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">No owner data</p>
                )}
              </div>

              {/* Company Info */}
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-2">Company Info</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-ink-faint">Timezone:</span> {detail.timezone}</div>
                  <div><span className="text-ink-faint">Currency:</span> {detail.currency}</div>
                  <div><span className="text-ink-faint">Industry:</span> {detail.industry || '—'}</div>
                  <div><span className="text-ink-faint">Size:</span> {detail.size || '—'}</div>
                  <div className="col-span-2"><span className="text-ink-faint">Locale:</span> {detail.locale}</div>
                  <div className="col-span-2"><span className="text-ink-faint">Billing Email:</span> {detail.billingEmail || '—'}</div>
                  <div className="col-span-2"><span className="text-ink-faint">Country:</span> {detail.country || '—'}</div>
                  <div className="col-span-2"><span className="text-ink-faint">Domain:</span> {detail.domain || '—'}</div>
                  <div className="col-span-2"><span className="text-ink-faint">Phone:</span> {detail.phone || '—'}</div>
                </div>
              </div>

              {/* Tax & Address Info */}
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-2">Tax &amp; Address</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-ink-faint">GST:</span> {detail.gstNumber || '—'}</div>
                  <div><span className="text-ink-faint">PAN:</span> {detail.panNumber || '—'}</div>
                  <div className="col-span-2">
                    <span className="text-ink-faint">Address: </span>
                    {detail.addressLine1 || detail.addressLine2 || detail.city || detail.state
                      ? `${detail.addressLine1 || ''}${detail.addressLine2 ? ', ' + detail.addressLine2 : ''}${detail.city ? ', ' + detail.city : ''}${detail.state ? ', ' + detail.state : ''}${detail.postalCode ? ' - ' + detail.postalCode : ''}`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              {(detail.status === 'PENDING_APPROVAL' || detail.status === 'REJECTED' || detail.verifiedAt) && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-2">Verification</p>
                  <div className="space-y-1.5 text-sm">
                    {detail.verifiedAt ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-accent" />
                        <span>
                          Verified on {fmtDate(detail.verifiedAt)}
                        </span>
                      </div>
                    ) : detail.status === 'REJECTED' ? (
                      <div className="flex items-start gap-2">
                        <XCircle size={14} className="mt-0.5 text-danger flex-shrink-0" />
                        <div>
                          <p className="font-medium text-danger">Rejected</p>
                          {detail.rejectionReason && (
                            <p className="text-ink-faint mt-0.5">{detail.rejectionReason}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-warning" />
                        <span className="text-ink-soft">Awaiting super admin approval</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Users, label: 'Employees', value: detail._count.employees },
                  { icon: Users, label: 'Users', value: detail._count.users },
                  { icon: Globe, label: 'Branches', value: detail._count.branches },
                  { icon: Building2, label: 'Departments', value: detail._count.departments },
                  { icon: Package, label: 'Assets', value: detail._count.assets },
                  { icon: HardDrive, label: 'Payroll Runs', value: detail._count.payrollRuns },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border p-3 text-center">
                    <stat.icon size={14} className="mx-auto mb-1 text-ink-faint" />
                    <p className="text-lg font-semibold text-ink">{stat.value}</p>
                    <p className="text-[10px] text-ink-faint">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Failed to load company details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Companies Page
// ──────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Action dialogs
  const [suspendTarget, setSuspendTarget] = useState<Company | null>(null);
  const [activateTarget, setActivateTarget] = useState<Company | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [resetPwdTarget, setResetPwdTarget] = useState<Company | null>(null);
  const [announceTarget, setAnnounceTarget] = useState<Company | null>(null);
  const [planTarget, setPlanTarget] = useState<Company | null>(null);
  const [limitsTarget, setLimitsTarget] = useState<Company | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Rich company list query
  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, search, statusFilter],
    queryFn: () =>
      unwrap<PaginatedResult<Company>>(
        api.get('/companies', {
          params: {
            page,
            limit: 20,
            search: search || undefined,
            status: statusFilter || undefined,
          },
        }),
      ),
  });

  // Mutations
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  }, [queryClient]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/companies/${id}/${action}`),
    onSuccess: () => { invalidate(); setSuspendTarget(null); setActivateTarget(null); setCancelTarget(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/companies/${id}/impersonate`),
    onSuccess: (res: any) => {
      const data = res.data as ImpersonateResult;
      saveSession({ accessToken: data.accessToken, refreshToken: '' });
      window.open('/', '_blank');
    },
  });

  const [pendingTarget, setPendingTarget] = useState<Company | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Company | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/companies/${id}/approve`),
    onSuccess: () => { invalidate(); setPendingTarget(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/companies/${id}/reject`, { reason }),
    onSuccess: () => { invalidate(); setRejectTarget(null); setRejectReason(''); },
  });

  // Pending approvals query
  const { data: pendingApprovals } = useQuery({
    queryKey: ['companies-pending-approvals'],
    queryFn: () => unwrap<Company[]>(api.get('/companies/pending/approvals')),
  });

  // Filter by tab
  const tabs = [
    { value: '', label: 'All Companies' },
    { value: 'PENDING_APPROVAL', label: `Pending Approvals${pendingApprovals && pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}` },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'TRIAL', label: 'Trial' },
    { value: 'TRIAL_EXPIRED', label: 'Expired Trials' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Companies</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Manage all tenant companies on the platform
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
      >
        <TabsList className="flex-wrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
                </div>
              ) : data && data.items.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Employees</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Trial Ends</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[60px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.items.map((company) => (
                          <TableRow
                            key={company.id}
                            className="group cursor-pointer"
                            onClick={() => { setSelectedCompany(company); setDetailOpen(true); }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                                  <Building2 size={14} className="text-accent" />
                                </div>
                                <div>
                                  <p className="font-medium text-ink">{company.name}</p>
                                  <p className="text-xs text-ink-faint">{company.slug}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {company.owner ? (
                                <div>
                                  <p className="text-sm text-ink">
                                    {company.owner.firstName || company.owner.lastName
                                      ? `${company.owner.firstName || ''} ${company.owner.lastName || ''}`.trim()
                                      : company.owner.email}
                                  </p>
                                  <p className="text-xs text-ink-faint">{company.owner.email}</p>
                                </div>
                              ) : (
                                <span className="text-sm text-ink-faint">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-ink">
                                {company.billingPlan?.name || company.subscriptionPlan || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-ink-soft">{company.employeeCount}</TableCell>
                            <TableCell>
                              <Badge tone={STATUS_BADGE[company.status] || 'default'}>
                                {company.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-ink-faint">
                              {fmtDate(company.trialEndsAt)}
                            </TableCell>
                            <TableCell className="text-sm text-ink-faint">
                              {fmtDate(company.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setOpenMenuId(openMenuId === company.id ? null : company.id)}
                                >
                                  <MoreHorizontal size={16} />
                                </Button>

                                {openMenuId === company.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                    <div className="absolute right-0 z-20 mt-1 w-56 origin-top-right rounded-xl border border-border bg-white py-1 shadow-lg">
                                      <ActionMenuItem
                                        icon={ExternalLink}
                                        label="View Profile"
                                        onClick={() => { router.push(`/companies/${company.id}`); setOpenMenuId(null); }}
                                      />
                                      <ActionMenuItem
                                        icon={ExternalLink}
                                        label="View Details"
                                        onClick={() => { setSelectedCompany(company); setDetailOpen(true); setOpenMenuId(null); }}
                                      />
                                      <ActionMenuItem
                                        icon={ExternalLink}
                                        label="Login as Company"
                                        onClick={() => { impersonateMutation.mutate(company.id); setOpenMenuId(null); }}
                                      />
                                      {company.status === 'PENDING_APPROVAL' && (
                                        <>
                                          <div className="border-t border-border my-1" />
                                          <ActionMenuItem
                                            icon={CheckCircle2}
                                            label="Approve Company"
                                            className="text-accent"
                                            onClick={() => { setPendingTarget(company); setOpenMenuId(null); }}
                                          />
                                          <ActionMenuItem
                                            icon={XCircle}
                                            label="Reject Company"
                                            className="text-danger"
                                            onClick={() => { setRejectTarget(company); setOpenMenuId(null); }}
                                          />
                                        </>
                                      )}
                                      <div className="border-t border-border my-1" />
                                      {company.isActive ? (
                                        <ActionMenuItem
                                          icon={Ban}
                                          label="Suspend"
                                          className="text-danger"
                                          onClick={() => { setSuspendTarget(company); setOpenMenuId(null); }}
                                        />
                                      ) : (
                                        <ActionMenuItem
                                          icon={CheckCircle2}
                                          label="Activate"
                                          className="text-accent"
                                          onClick={() => { setActivateTarget(company); setOpenMenuId(null); }}
                                        />
                                      )}
                                      {company.status !== 'CANCELLED' && (
                                        <ActionMenuItem
                                          icon={XCircle}
                                          label="Cancel Company"
                                          className="text-danger"
                                          onClick={() => { setCancelTarget(company); setOpenMenuId(null); }}
                                        />
                                      )}
                                      <ActionMenuItem
                                        icon={Trash2}
                                        label="Delete Company"
                                        className="text-danger"
                                        onClick={() => { setDeleteTarget(company); setOpenMenuId(null); }}
                                      />
                                      <div className="border-t border-border my-1" />
                                      <ActionMenuItem
                                        icon={KeyRound}
                                        label="Reset Password"
                                        onClick={() => { setResetPwdTarget(company); setOpenMenuId(null); }}
                                      />
                                      <ActionMenuItem
                                        icon={CreditCard}
                                        label="Change Plan"
                                        onClick={() => { setPlanTarget(company); setOpenMenuId(null); }}
                                      />
                                      <ActionMenuItem
                                        icon={Database}
                                        label="Update Limits"
                                        onClick={() => { setLimitsTarget(company); setOpenMenuId(null); }}
                                      />
                                      <ActionMenuItem
                                        icon={Mail}
                                        label="Send Announcement"
                                        onClick={() => { setAnnounceTarget(company); setOpenMenuId(null); }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between border-t border-border px-6 py-4">
                    <p className="text-sm text-ink-faint">
                      Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} · {data.meta.total} total companies
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={14} /> Previous
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={page >= data.meta.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Building2 size={40} className="mb-3 text-ink-faint/40" />
                  <p className="text-sm font-medium text-ink-faint">
                    {search || statusFilter ? 'No companies match your filters.' : 'No companies registered yet.'}
                  </p>
                  {(search || statusFilter) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => { setSearch(''); setStatusFilter(''); }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ──────────────────────────────────────────────── */}
      {/* Dialogs                                      */}
      {/* ──────────────────────────────────────────────── */}

      <ConfirmActionDialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspend company?"
        description="All users in this company will lose access until reactivated."
        confirmLabel="Suspend"
        confirmVariant="destructive"
        onConfirm={() => suspendTarget && toggleMutation.mutate({ id: suspendTarget.id, action: 'suspend' })}
        isLoading={toggleMutation.isPending}
      />

      <ConfirmActionDialog
        open={!!activateTarget}
        onClose={() => setActivateTarget(null)}
        title="Activate company?"
        description="The company and its users will regain access."
        confirmLabel="Activate"
        confirmVariant="default"
        onConfirm={() => activateTarget && toggleMutation.mutate({ id: activateTarget.id, action: 'activate' })}
        isLoading={toggleMutation.isPending}
      />

      <ConfirmActionDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel company?"
        description="This will permanently disable the company. Users will lose access. Consider suspending instead."
        confirmLabel="Cancel Company"
        confirmVariant="destructive"
        onConfirm={() => cancelTarget && toggleMutation.mutate({ id: cancelTarget.id, action: 'cancel' })}
        isLoading={toggleMutation.isPending}
      />

      <ConfirmActionDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete company?"
        description="This will soft-delete the company. All data will be preserved but inaccessible. This action can be reversed."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />

      {resetPwdTarget && (
        <ResetPasswordDialog
          open={!!resetPwdTarget}
          onClose={() => setResetPwdTarget(null)}
          companyId={resetPwdTarget.id}
          onSuccess={invalidate}
        />
      )}

      {announceTarget && (
        <AnnouncementDialog
          open={!!announceTarget}
          onClose={() => setAnnounceTarget(null)}
          companyId={announceTarget.id}
          onSuccess={invalidate}
        />
      )}

      {planTarget && (
        <ChangePlanDialog
          open={!!planTarget}
          onClose={() => setPlanTarget(null)}
          companyId={planTarget.id}
          onSuccess={invalidate}
          currentPlan={planTarget.billingPlan?.name || planTarget.subscriptionPlan || null}
        />
      )}

      {limitsTarget && (
        <UpdateLimitsDialog
          open={!!limitsTarget}
          onClose={() => setLimitsTarget(null)}
          companyId={limitsTarget.id}
          onSuccess={invalidate}
        />
      )}

      {/* Approve/Reject dialogs */}
      <ConfirmActionDialog
        open={!!pendingTarget}
        onClose={() => setPendingTarget(null)}
        title="Approve company?"
        description="This will activate the company. The owner will be able to log in and start using the platform."
        confirmLabel="Approve"
        confirmVariant="default"
        onConfirm={() => pendingTarget && approveMutation.mutate(pendingTarget.id)}
        isLoading={approveMutation.isPending}
      />

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject company?</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this company. The owner will see this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Rejection Reason</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the company was rejected..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              isLoading={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })}
            >
              Reject Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Panel */}
      {detailOpen && selectedCompany && (
        <CompanyDetailPanel
          company={selectedCompany}
          onClose={() => { setDetailOpen(false); setSelectedCompany(null); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Action Menu Item
// ──────────────────────────────────────────────────────────────────

function ActionMenuItem({
  icon: Icon, label, onClick, className,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors ${className || ''}`}
      onClick={onClick}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
