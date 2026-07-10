'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { AttendanceRegularization, PaginatedResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, CheckCircle, XCircle, AlertCircle, History, Send } from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceRegularizationPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [requestedStatus, setRequestedStatus] = useState('PRESENT');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'attendance-regularizations', page],
    queryFn: () => unwrap<PaginatedResult<AttendanceRegularization>>(
      api.get('/me/attendance/regularizations', { params: { page, limit: 20 } }),
    ),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/me/attendance/regularizations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'attendance-regularizations'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err?.message || 'Something went wrong.');
    },
  });

  function resetForm() {
    setDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setRequestedCheckIn('');
    setRequestedCheckOut('');
    setRequestedStatus('PRESENT');
    setNotes('');
    setFormError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!reason.trim()) {
      setFormError('Please provide a reason for regularization.');
      return;
    }
    createMut.mutate({
      date,
      reason,
      requestedCheckIn: requestedCheckIn || undefined,
      requestedCheckOut: requestedCheckOut || undefined,
      requestedStatus: requestedStatus || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Regularization</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Submit a request to correct or explain past attendance records
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Send size={14} className="mr-1.5" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Regularization Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Date *</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Requested Check-In</label>
                  <Input type="time" value={requestedCheckIn} onChange={(e) => setRequestedCheckIn(e.target.value)} />
                  <p className="mt-0.5 text-[10px] text-ink-faint">Optional: what time you actually arrived</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Requested Check-Out</label>
                  <Input type="time" value={requestedCheckOut} onChange={(e) => setRequestedCheckOut(e.target.value)} />
                  <p className="mt-0.5 text-[10px] text-ink-faint">Optional: what time you actually left</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Requested Status</label>
                <Select value={requestedStatus} onValueChange={(val) => setRequestedStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Reason *</label>
                <textarea
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                  rows={3}
                  placeholder="Explain why you need this attendance regularized..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Additional Notes</label>
                <textarea
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                  rows={2}
                  placeholder="Any supporting details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {formError && (
                <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMut.isPending}>
                  Submit Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={16} />
            My Regularization Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading requests…</p>}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested Times</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium text-ink">{formatDate(req.date)}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-ink-soft" title={req.reason}>
                        {req.reason}
                      </TableCell>
                      <TableCell className="text-ink-soft">
                        {req.requestedCheckIn || req.requestedCheckOut ? (
                          <span className="text-xs">
                            {req.requestedCheckIn ? `In: ${formatDateTime(req.requestedCheckIn)}` : ''}
                            {req.requestedCheckIn && req.requestedCheckOut ? ' · ' : ''}
                            {req.requestedCheckOut ? `Out: ${formatDateTime(req.requestedCheckOut)}` : ''}
                          </span>
                        ) : (
                          <span className="text-ink-faint">No changes</span>
                        )}
                        {req.requestedStatus && (
                          <Badge variant="default" className="ml-1 text-[10px]">{req.requestedStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONES[req.status] || 'default'}>
                          {req.status === 'PENDING' && <AlertCircle size={10} className="mr-1" />}
                          {req.status === 'APPROVED' && <CheckCircle size={10} className="mr-1" />}
                          {req.status === 'REJECTED' && <XCircle size={10} className="mr-1" />}
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-faint text-xs">
                        {formatDateTime(req.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-ink-soft">
                        {req.status === 'REJECTED' && req.rejectionReason ? (
                          <span className="text-danger">{req.rejectionReason}</span>
                        ) : req.status === 'APPROVED' ? (
                          <span className="text-emerald-600">✓ Approved</span>
                        ) : (
                          <span className="text-ink-faint">Awaiting review</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-ink-faint">
                        <div className="flex flex-col items-center gap-2">
                          <Clock size={32} className="text-ink-faint/50" />
                          <p>No regularization requests yet.</p>
                          <p className="text-xs">Click &quot;New Request&quot; to submit one.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
