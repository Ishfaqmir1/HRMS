'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, unwrap } from '@/lib/api-client';
import { PayrollRun, Payslip, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Plus, Play, XCircle, Eye, CheckCircle, FileText,
  Send, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

const createRunSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  notes: z.string().optional(),
});
type CreateRunForm = z.infer<typeof createRunSchema>;

export default function PayrollRunsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createDialog, setCreateDialog] = useState(false);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<string | null>(null);

  // Approval workflow state
  const [confirmSubmit, setConfirmSubmit] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateRunForm>({
    resolver: zodResolver(createRunSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
  });

  // ── Queries ────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'runs', page],
    queryFn: () => unwrap<PaginatedResult<PayrollRun>>(api.get('/payroll/runs', { params: { page, limit: 20 } })),
  });

  const { data: runDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['payroll', 'runs', detailRunId, 'detail'],
    queryFn: () => unwrap<PayrollRun>(api.get(`/payroll/runs/${detailRunId}`)),
    enabled: !!detailRunId,
  });

  // ── Mutations ──────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (values: CreateRunForm) =>
      api.post('/payroll/runs', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setCreateDialog(false);
      reset();
    },
  });

  const processMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setConfirmProcess(null);
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setConfirmComplete(null);
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs', detailRunId] });
      setConfirmCancel(null);
      setDetailRunId(null);
    },
  });

  // ── Approval Workflow Mutations ───────────────────────────
  const submitMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/submit-for-approval`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setConfirmSubmit(null);
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve-run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setConfirmApprove(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/payroll/runs/${id}/reject-run`, { rejectionReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setRejectDialog(null);
      setRejectReason('');
    },
  });

  // ── Status badge helper ────────────────────────────────────
  function runBadge(status: string) {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'DRAFT': return 'warning';
      case 'PENDING_APPROVAL': return 'default';
      case 'APPROVED': return 'success';
      case 'PROCESSING': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'default';
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Payroll Runs</h1>
          <p className="mt-1 text-sm text-ink-faint">Create, process, and manage payroll runs.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll/payslips">
            <Button variant="outline" size="sm">
              <FileText size={14} /> Payslips
            </Button>
          </Link>
          <Button onClick={() => setCreateDialog(true)}>
            <Plus size={16} /> New Run
          </Button>
        </div>
      </div>

      {/* Runs Table */}
      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading payroll runs…</p>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="w-16">Ver.</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-72">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-ink">
                        {MONTHS[run.month - 1]} {run.year}
                      </TableCell>
                      <TableCell className="text-xs text-ink-faint">
                        {run.version ?? 1}
                      </TableCell>
                      <TableCell>{run.employeeCount}</TableCell>
                      <TableCell>{fmt(run.totalGross)}</TableCell>
                      <TableCell className="text-danger">{fmt(run.totalDeductions)}</TableCell>
                      <TableCell className="text-accent font-medium">{fmt(run.totalNet)}</TableCell>
                      <TableCell>
                        <Badge variant={runBadge(run.status) as any}>{run.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setDetailRunId(run.id); refetchDetail(); }}
                            title="View details"
                          >
                            <Eye size={14} />
                          </Button>

                          {/* DRAFT — Submit for approval or process directly */}
                          {run.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmSubmit(run.id)}
                                title="Submit for approval"
                              >
                                <Send size={14} />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmProcess(run.id)}
                                title="Process run (generate payslips)"
                              >
                                <Play size={14} />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmCancel(run.id)}
                                title="Cancel run"
                              >
                                <XCircle size={14} />
                              </Button>
                            </>
                          )}

                          {/* PENDING_APPROVAL — Approve or reject */}
                          {run.status === 'PENDING_APPROVAL' && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmApprove(run.id)}
                                title="Approve run"
                              >
                                <ThumbsUp size={14} />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { setRejectDialog(run.id); setRejectReason(''); }}
                                title="Reject run"
                              >
                                <ThumbsDown size={14} />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmCancel(run.id)}
                                title="Cancel run"
                              >
                                <XCircle size={14} />
                              </Button>
                            </>
                          )}

                          {/* APPROVED — Process or cancel */}
                          {run.status === 'APPROVED' && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmProcess(run.id)}
                                title="Process run (generate payslips)"
                              >
                                <Play size={14} />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmCancel(run.id)}
                                title="Cancel run"
                              >
                                <XCircle size={14} />
                              </Button>
                            </>
                          )}

                          {run.status === 'COMPLETED' && (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setConfirmComplete(run.id)}
                                title="Complete run"
                              >
                                <CheckCircle size={14} />
                              </Button>
                              <Link href={`/payroll/payslips`}>
                                <Button variant="ghost" size="sm" title="View payslips">
                                  <FileText size={14} />
                                </Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <FileText size={32} className="mx-auto mb-2 text-ink-faint" />
                        <p className="text-sm text-ink-faint">No payroll runs yet. Create one to get started.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>
                  Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)}
                  {' · '}
                  {data.meta.total} runs total
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* CREATE RUN DIALOG                                              */}
      {/* ================================================================ */}
      <Dialog open={createDialog} onOpenChange={(o) => { if (!o) setCreateDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Payroll Run</DialogTitle>
            <DialogDescription>
              Select the month and year to process payroll for.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => createMut.mutate(values))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="month">Month</Label>
                <select
                  id="month"
                  {...register('month')}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
                <FieldError message={errors.month?.message} />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" {...register('year')} />
                <FieldError message={errors.year?.message} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                {...register('notes')}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="e.g., Monthly payroll for Engineering team"
              />
            </div>
            {createMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(createMut.error as any)?.response?.data?.message || 'Failed to create run.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMut.isPending}>Create Run</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* RUN DETAIL DIALOG                                               */}
      {/* ================================================================ */}
      <Dialog open={!!detailRunId} onOpenChange={(o) => { if (!o) setDetailRunId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          {runDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>
                    Run: {MONTHS[runDetail.month - 1]} {runDetail.year}
                  </DialogTitle>
                  <Badge variant={runBadge(runDetail.status) as any}>{runDetail.status.replace(/_/g, ' ')}</Badge>
                </div>
                <DialogDescription>
                  Version {runDetail.version ?? 1}
                  {runDetail.processedAt && ` · Processed ${new Date(runDetail.processedAt).toLocaleDateString()}`}
                  {runDetail.notes && ` · ${runDetail.notes}`}
                </DialogDescription>
              </DialogHeader>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-paper p-4 text-center">
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Gross Pay</p>
                  <p className="mt-1 font-serif text-xl font-semibold text-ink">{fmt(runDetail.totalGross)}</p>
                </div>
                <div className="rounded-xl bg-paper p-4 text-center">
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Deductions</p>
                  <p className="mt-1 font-serif text-xl font-semibold text-danger">{fmt(runDetail.totalDeductions)}</p>
                </div>
                <div className="rounded-xl bg-paper p-4 text-center">
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Net Pay</p>
                  <p className="mt-1 font-serif text-xl font-semibold text-accent">{fmt(runDetail.totalNet)}</p>
                </div>
              </div>

              {/* Payslips */}
              {runDetail.payslips && runDetail.payslips.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-ink">Payslips ({runDetail.payslips.length})</h3>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Net</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runDetail.payslips.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-ink">
                              {p.employee?.firstName} {p.employee?.lastName}
                            </TableCell>
                            <TableCell className="text-ink-faint">{p.employee?.employeeCode}</TableCell>
                            <TableCell>{fmt(p.grossPay)}</TableCell>
                            <TableCell className="text-accent font-medium">{fmt(p.netPay)}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'APPROVED' ? 'default' : 'warning'}>
                                {p.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => setDetailRunId(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* SUBMIT FOR APPROVAL DIALOG                                     */}
      {/* ================================================================ */}
      <Dialog open={!!confirmSubmit} onOpenChange={(o) => { if (!o) setConfirmSubmit(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              Submit this draft run for review. An approver will need to approve it before
              it can be processed. You can still edit the run after submission if it gets rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-accent/[0.04] border border-accent/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <Send size={16} className="mt-0.5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent">Approval Workflow</p>
                <ul className="mt-1 text-xs text-ink-soft space-y-0.5 list-disc list-inside">
                  <li>DRAFT → Pending Approval</li>
                  <li>Approver reviews the run details</li>
                  <li>If approved: run can be processed to generate payslips</li>
                  <li>If rejected: run returns to DRAFT for corrections</li>
                </ul>
              </div>
            </div>
          </div>
          {submitMut.isError && (
            <p className="text-sm text-danger">
              {(submitMut.error as any)?.response?.data?.message || 'Submission failed.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(null)}>Cancel</Button>
            <Button
              onClick={() => confirmSubmit && submitMut.mutate(confirmSubmit)}
              isLoading={submitMut.isPending}
            >
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* APPROVE RUN DIALOG                                              */}
      {/* ================================================================ */}
      <Dialog open={!!confirmApprove} onOpenChange={(o) => { if (!o) setConfirmApprove(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Payroll Run</DialogTitle>
            <DialogDescription>
              Approve this payroll run. Once approved, it can be processed to generate payslips
              for all active employees.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-success-soft/40 border border-success/20 px-4 py-3">
            <p className="text-sm text-success flex items-center gap-2">
              <ThumbsUp size={16} />
              <span>Approving this run will allow processing to begin.</span>
            </p>
          </div>
          {approveMut.isError && (
            <p className="text-sm text-danger">
              {(approveMut.error as any)?.response?.data?.message || 'Approval failed.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(null)}>Cancel</Button>
            <Button
              variant="default"
              onClick={() => confirmApprove && approveMut.mutate(confirmApprove)}
              isLoading={approveMut.isPending}
            >
              Approve Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* REJECT RUN DIALOG                                               */}
      {/* ================================================================ */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => { if (!o) { setRejectDialog(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payroll Run</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The run will return to DRAFT status so corrections can be made.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectReason">Rejection Reason *</Label>
              <textarea
                id="rejectReason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="Explain why this run is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            {rejectMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(rejectMut.error as any)?.response?.data?.message || 'Rejection failed.'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={() => rejectDialog && rejectMut.mutate({ id: rejectDialog, reason: rejectReason.trim() })}
              isLoading={rejectMut.isPending}
            >
              Reject Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* CONFIRM PROCESS DIALOG                                          */}
      {/* ================================================================ */}
      <Dialog open={!!confirmProcess} onOpenChange={(o) => { if (!o) setConfirmProcess(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Payroll Run</DialogTitle>
            <DialogDescription>
              This will generate payslips for all active employees based on their current salaries.
              Deductions for taxes, pension, insurance, and active loans will be computed automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-accent/[0.04] border border-accent/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <Play size={16} className="mt-0.5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent">What will happen?</p>
                <ul className="mt-1 text-xs text-ink-soft space-y-0.5 list-disc list-inside">
                  <li>Payslips generated for all active employees</li>
                  <li>Salaries, allowances, and deductions calculated</li>
                  <li>Active loan deductions included</li>
                  <li>Statutory compliance (PF, ESI, PT, TDS) applied</li>
                  <li>Run status changes to COMPLETED</li>
                </ul>
              </div>
            </div>
          </div>
          {processMut.isError && (
            <p className="text-sm text-danger">
              {(processMut.error as any)?.response?.data?.message || 'Processing failed.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmProcess(null)}>Cancel</Button>
            <Button
              onClick={() => confirmProcess && processMut.mutate(confirmProcess)}
              isLoading={processMut.isPending}
            >
              Process Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* CONFIRM COMPLETE DIALOG                                         */}
      {/* ================================================================ */}
      <Dialog open={!!confirmComplete} onOpenChange={(o) => { if (!o) setConfirmComplete(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payroll Run</DialogTitle>
            <DialogDescription>
              Mark this run as completed. This is a final confirmation step.
            </DialogDescription>
          </DialogHeader>
          {completeMut.isError && (
            <p className="text-sm text-danger">
              {(completeMut.error as any)?.response?.data?.message || 'Failed to complete run.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmComplete(null)}>Cancel</Button>
            <Button
              onClick={() => confirmComplete && completeMut.mutate(confirmComplete)}
              isLoading={completeMut.isPending}
            >
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* CONFIRM CANCEL DIALOG                                           */}
      {/* ================================================================ */}
      <Dialog open={!!confirmCancel} onOpenChange={(o) => { if (!o) setConfirmCancel(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Payroll Run</DialogTitle>
            <DialogDescription>
              This will cancel the run and delete any generated payslips. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-danger-soft/40 border border-danger/20 px-4 py-3">
            <p className="text-sm text-danger">
              <strong>Warning:</strong> All payslips associated with this run will be permanently deleted.
            </p>
          </div>
          {cancelMut.isError && (
            <p className="text-sm text-danger">
              {(cancelMut.error as any)?.response?.data?.message || 'Cancellation failed.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep Run</Button>
            <Button
              variant="destructive"
              onClick={() => confirmCancel && cancelMut.mutate(confirmCancel)}
              isLoading={cancelMut.isPending}
            >
              Yes, Cancel Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
