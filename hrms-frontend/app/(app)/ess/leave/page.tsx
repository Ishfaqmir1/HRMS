'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, LeaveRequest, LeaveBalance } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus, CalendarDays, Clock, Loader2, CheckCircle, XCircle, AlertCircle, Send,
} from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger', CANCELLED: 'danger',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  APPROVED: CheckCircle, PENDING: AlertCircle, REJECTED: XCircle, CANCELLED: XCircle,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LeaveHistoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  // ── Apply Leave Form state ──
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  // ── Queries ──

  const { data: leaveData, isLoading } = useQuery({
    queryKey: ['me', 'leave-history', page],
    queryFn: () => unwrap<PaginatedResult<LeaveRequest>>(api.get('/me/leave/history', { params: { page, limit: 20 } })),
  });

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['me', 'leave-balances'],
    queryFn: () => unwrap<LeaveBalance[]>(api.get('/me/leave/balances')),
  });

  // ── Mutations ──

  const applyLeaveMut = useMutation({
    mutationFn: (body: { leaveTypeId: string; startDate: string; endDate: string; reason: string }) =>
      api.post('/leave/requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'leave-history'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      resetForm();
      setShowApplyDialog(false);
    },
  });

  const cancelLeaveMut = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'leave-history'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'leave-balances'] });
    },
  });

  const resetForm = useCallback(() => {
    setLeaveTypeId('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setFormError('');
  }, []);

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!leaveTypeId) { setFormError('Please select a leave type.'); return; }
    if (!startDate) { setFormError('Please select a start date.'); return; }
    if (!endDate) { setFormError('Please select an end date.'); return; }
    if (new Date(endDate) < new Date(startDate)) { setFormError('End date cannot be before start date.'); return; }
    if (!reason.trim()) { setFormError('Please provide a reason.'); return; }

    applyLeaveMut.mutate({ leaveTypeId, startDate, endDate, reason });
  };

  // Compute available days for selected leave type
  const selectedBalance = balances?.find(b => b.leaveType.id === leaveTypeId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Leave</h1>
          <p className="mt-0.5 text-sm text-ink-faint">View your leave history and apply for leave</p>
        </div>
        <Button onClick={() => { resetForm(); applyLeaveMut.reset(); setShowApplyDialog(true); }}>
          <Plus size={14} className="mr-1.5" />
          Apply for Leave
        </Button>
      </div>

      {/* ─── Leave Balances ─── */}
      {balancesLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : balances && balances.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balances.map((b) => {
            const available = b.allocated + b.carriedForward - b.used;
            const total = b.allocated + b.carriedForward;
            const pct = total > 0 ? (available / total) * 100 : 0;
            return (
              <div key={b.id} className="rounded-xl border border-border bg-white p-4 transition-colors hover:shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">{b.leaveType.name}</span>
                  {b.leaveType.isPaid ? (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[8px] font-medium text-accent">PAID</span>
                  ) : (
                    <span className="rounded-full bg-ink-soft/10 px-1.5 py-0.5 text-[8px] font-medium text-ink-faint">UNPAID</span>
                  )}
                </div>
                <p className="font-serif text-2xl font-semibold text-ink">{available.toFixed(1)}</p>
                <p className="text-[10px] text-ink-faint">of {total.toFixed(1)} days</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-soft/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-6 text-center">
          <p className="text-sm text-ink-faint">No leave balances configured yet.</p>
        </div>
      )}

      {/* ─── Leave History ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays size={16} />
            Leave History
          </CardTitle>
          {leaveData && (
            <span className="text-xs text-ink-faint">{leaveData.meta.total} total</span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-faint" />
            </div>
          ) : leaveData && leaveData.items.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">From</th>
                      <th className="px-5 py-3">To</th>
                      <th className="px-5 py-3">Days</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaveData.items.map((lr) => {
                      const StatusIcon = STATUS_ICONS[lr.status] || AlertCircle;
                      return (
                        <tr key={lr.id} className="transition-colors hover:bg-ink-soft/5">
                          <td className="px-5 py-3 text-sm font-medium text-ink">
                            <Badge variant="default" className="text-[10px]">{lr.leaveType.name}</Badge>
                          </td>
                          <td className="px-5 py-3 text-sm text-ink">{formatDate(lr.startDate)}</td>
                          <td className="px-5 py-3 text-sm text-ink">{formatDate(lr.endDate)}</td>
                          <td className="px-5 py-3 text-sm font-medium text-ink">{lr.totalDays}</td>
                          <td className="max-w-[160px] truncate px-5 py-3 text-sm text-ink-soft" title={lr.reason || ''}>
                            {lr.reason || '—'}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={STATUS_TONES[lr.status] || 'default'} className="text-[10px]">
                              <StatusIcon size={10} className="mr-1" />
                              {lr.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-xs text-ink-faint">
                            {new Date(lr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-5 py-3">
                            {lr.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelLeaveMut.mutate(lr.id)}
                                isLoading={cancelLeaveMut.isPending}
                                className="h-7 text-[10px] text-danger hover:text-danger"
                              >
                                <XCircle size={10} className="mr-1" />
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-border sm:hidden">
                {leaveData.items.map((lr) => {
                  const StatusIcon = STATUS_ICONS[lr.status] || AlertCircle;
                  return (
                    <div key={lr.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="default" className="text-[10px]">{lr.leaveType.name}</Badge>
                        <Badge tone={STATUS_TONES[lr.status] || 'default'} className="text-[9px]">
                          <StatusIcon size={8} className="mr-0.5" />
                          {lr.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <span>{formatDate(lr.startDate)}</span>
                        <span className="text-ink-faint">→</span>
                        <span>{formatDate(lr.endDate)}</span>
                        <span className="ml-auto text-ink-faint">{lr.totalDays}d</span>
                      </div>
                      {lr.reason && (
                        <p className="text-xs text-ink-soft line-clamp-2">{lr.reason}</p>
                      )}
                      {lr.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelLeaveMut.mutate(lr.id)}
                          isLoading={cancelLeaveMut.isPending}
                          className="h-7 text-[10px] text-danger px-0 hover:text-danger"
                        >
                          <XCircle size={10} className="mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {leaveData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-ink-faint">
                    Page {leaveData.meta.page} of {leaveData.meta.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= leaveData.meta.totalPages} onClick={() => setPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CalendarDays size={32} className="text-ink-faint/40" />
              <p className="text-sm text-ink-faint">No leave history yet.</p>
              <p className="text-xs text-ink-faint">
                Click <strong className="text-accent">Apply for Leave</strong> above to submit your first request.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Apply Leave Dialog ─── */}
      <Dialog open={showApplyDialog} onOpenChange={(open) => {
        if (!open) { resetForm(); setShowApplyDialog(false); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays size={18} className="text-accent" />
              Apply for Leave
            </DialogTitle>
            <DialogDescription>
              Submit a new leave request for review
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplyLeave} className="space-y-4">
            {/* Leave Type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Leave Type *</label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {balances?.map((b) => {
                    const available = b.allocated + b.carriedForward - b.used;
                    return (
                      <SelectItem key={b.leaveType.id} value={b.leaveType.id}>
                        <span className="flex items-center justify-between w-full gap-3">
                          <span>{b.leaveType.name}</span>
                          <span className={`text-[10px] ${available > 0 ? 'text-ink-faint' : 'text-danger'}`}>
                            {available.toFixed(1)} left
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Balance indicator */}
            {leaveTypeId && selectedBalance && (
              <div className="rounded-lg bg-accent-soft/50 px-3 py-2 text-xs text-accent">
                <span className="font-medium">{selectedBalance.leaveType.name}</span>
                {' '}balance: <strong>{(selectedBalance.allocated + selectedBalance.carriedForward - selectedBalance.used).toFixed(1)}</strong> of {selectedBalance.allocated.toFixed(1)} days
                {selectedBalance.leaveType.requiresApproval && (
                  <span className="ml-2 opacity-70">(requires approval)</span>
                )}
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">Start Date *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  required
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">End Date *</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  required
                  className="h-9"
                />
              </div>
            </div>

            {/* Quick duration display */}
            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Clock size={12} />
                <span>
                  ~{Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} day(s)
                  {' '}(weekdays only, holidays excluded)
                </span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink">Reason *</label>
              <textarea
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent min-h-[80px] resize-none"
                placeholder="Why do you need leave? E.g. 'Family function', 'Not feeling well'"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* Error */}
            {(formError || applyLeaveMut.error) && (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {formError || (applyLeaveMut.error as any)?.response?.data?.message || (applyLeaveMut.error as any)?.message || 'Failed to submit leave request.'}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              isLoading={applyLeaveMut.isPending}
            >
              <Send size={14} className="mr-1.5" />
              Submit Leave Request
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
