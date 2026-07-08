'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { AttendanceRegularization, PaginatedResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Clock, CheckCircle, XCircle, AlertCircle, User, Shield } from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger',
};

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminRegularizationPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [searchEmployee, setSearchEmployee] = useState('');

  // Rejection dialog
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Detail dialog
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-regularizations', page, filterStatus],
    queryFn: () => unwrap<PaginatedResult<AttendanceRegularization>>(
      api.get('/attendance-regularization', {
        params: {
          page,
          limit: 20,
          ...(filterStatus !== 'ALL' ? { status: filterStatus } : {}),
        },
      }),
    ),
  });

  const { data: detail } = useQuery({
    queryKey: ['attendance-regularization', detailId],
    queryFn: () => unwrap<AttendanceRegularization>(api.get(`/attendance-regularization/${detailId}`)),
    enabled: !!detailId,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/attendance-regularization/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-regularizations'] });
      setDetailId(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.post(`/attendance-regularization/${id}/reject`, { rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-regularizations'] });
      setRejectDialogId(null);
      setRejectionReason('');
      setDetailId(null);
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Regularization</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Review and manage employee attendance regularization requests
          </p>
        </div>
        <Badge tone="warning">
          <AlertCircle size={12} className="mr-1" />
          {data?.meta.total ?? 0} requests
        </Badge>
      </div>

      <Tabs defaultValue="PENDING" onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="PENDING">
            <AlertCircle size={12} className="mr-1" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="APPROVED">
            <CheckCircle size={12} className="mr-1" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="REJECTED">
            <XCircle size={12} className="mr-1" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="ALL">
            All
          </TabsTrigger>
        </TabsList>

        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {tab === 'PENDING' ? <AlertCircle size={16} /> : tab === 'APPROVED' ? <CheckCircle size={16} /> : tab === 'REJECTED' ? <XCircle size={16} /> : <Clock size={16} />}
                  {tab === 'PENDING' ? 'Pending Requests' : tab === 'APPROVED' ? 'Approved Requests' : tab === 'REJECTED' ? 'Rejected Requests' : 'All Requests'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && <p className="text-sm text-ink-faint">Loading requests…</p>}
                {data && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Requested Changes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.items.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-ink-faint" />
                                <span className="font-medium text-ink">
                                  {req.employee?.firstName} {req.employee?.lastName}
                                </span>
                                <span className="text-xs text-ink-faint">({req.employee?.employeeCode})</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-ink">{formatDate(req.date)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-ink-soft" title={req.reason}>
                              {req.reason}
                            </TableCell>
                            <TableCell className="text-xs text-ink-soft">
                              {req.requestedCheckIn && <div>In: {formatDateTime(req.requestedCheckIn)}</div>}
                              {req.requestedCheckOut && <div>Out: {formatDateTime(req.requestedCheckOut)}</div>}
                              {req.requestedStatus && <Badge variant="default" className="text-[10px]">{req.requestedStatus}</Badge>}
                              {!req.requestedCheckIn && !req.requestedCheckOut && !req.requestedStatus && (
                                <span className="text-ink-faint">Record correction</span>
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
                            <TableCell className="text-xs text-ink-faint">{formatDateTime(req.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDetailId(req.id)}
                                >
                                  View
                                </Button>
                                {req.status === 'PENDING' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => approveMut.mutate(req.id)}
                                      isLoading={approveMut.isPending && approveMut.variables === req.id}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => { setRejectDialogId(req.id); setRejectionReason(''); }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {data?.items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-ink-faint">
                              <div className="flex flex-col items-center gap-2">
                                {tab === 'PENDING' ? (
                                  <><Shield size={32} className="text-ink-faint/50" /><p>No pending requests.</p></>
                                ) : (
                                  <><Clock size={32} className="text-ink-faint/50" /><p>No {tab.toLowerCase()} requests found.</p></>
                                )}
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
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Regularization Request Details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Employee</p>
                  <p className="font-medium text-ink">{detail.employee?.firstName} {detail.employee?.lastName}</p>
                  <p className="text-xs text-ink-faint">{detail.employee?.employeeCode}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Attendance Date</p>
                  <p className="font-medium text-ink">{formatDate(detail.date)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-ink-faint uppercase tracking-wide mb-1">Reason</p>
                <div className="rounded-md bg-paper px-3 py-2 text-sm text-ink">{detail.reason}</div>
              </div>

              {detail.notes && (
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide mb-1">Additional Notes</p>
                  <div className="rounded-md bg-paper px-3 py-2 text-sm text-ink">{detail.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Requested Check-In</p>
                  <p className="font-medium text-ink">{formatDateTime(detail.requestedCheckIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Requested Check-Out</p>
                  <p className="font-medium text-ink">{formatDateTime(detail.requestedCheckOut)}</p>
                </div>
              </div>

              {detail.requestedStatus && (
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wide">Requested Status</p>
                  <Badge variant="default">{detail.requestedStatus}</Badge>
                </div>
              )}

              {detail.attendance && (
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-ink-faint uppercase tracking-wide mb-2">Current Attendance Record</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-ink-faint">In: </span>
                      <span className="text-ink">{formatDateTime(detail.attendance.checkIn)}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint">Out: </span>
                      <span className="text-ink">{formatDateTime(detail.attendance.checkOut)}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint">Status: </span>
                      <Badge variant="default" className="text-[10px]">{detail.attendance.status}</Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Badge tone={STATUS_TONES[detail.status] || 'default'}>
                  {detail.status}
                </Badge>
                {detail.status === 'REJECTED' && detail.rejectionReason && (
                  <div className="text-sm text-danger">{detail.rejectionReason}</div>
                )}
                {detail.approvedBy && (
                  <div className="text-xs text-ink-faint">
                    By: {detail.approvedBy.firstName} {detail.approvedBy.lastName}
                  </div>
                )}
              </div>

              {detail.status === 'PENDING' && (
                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => { setRejectDialogId(detail.id); setDetailId(null); }}
                  >
                    <XCircle size={14} className="mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveMut.mutate(detail.id)}
                    isLoading={approveMut.isPending}
                  >
                    <CheckCircle size={14} className="mr-1.5" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={(open) => { if (!open) { setRejectDialogId(null); setRejectionReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Reason for rejection *</label>
              <textarea
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                rows={3}
                placeholder="Explain why this request is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRejectDialogId(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (rejectDialogId && rejectionReason.trim()) {
                    rejectMut.mutate({ id: rejectDialogId, rejectionReason });
                  }
                }}
                isLoading={rejectMut.isPending}
                disabled={!rejectionReason.trim()}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
