'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, unwrap } from '@/lib/api-client';
import { LeaveBalance, LeaveRequest, LeaveType, PaginatedResult } from '@/lib/types';
import { STALE_TIMES } from '@/lib/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge, statusTone } from '@/components/ui/badge';

const schema = z.object({
  leaveTypeId: z.string().min(1, 'Select a leave type'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  reason: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LeavePage() {
  const queryClient = useQueryClient();

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => unwrap<LeaveType[]>(api.get('/leave-types')),
    staleTime: STALE_TIMES.MASTER_DATA, // 10min — rarely changes
  });

  const { data: balances } = useQuery({
    queryKey: ['leave', 'balances'],
    queryFn: () => unwrap<LeaveBalance[]>(api.get('/leave/balances/me')),
    staleTime: STALE_TIMES.LEAVE,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave', 'requests'],
    queryFn: () => unwrap<PaginatedResult<LeaveRequest>>(api.get('/leave/requests/me', { params: { limit: 15 } })),
    staleTime: STALE_TIMES.LEAVE,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const submitRequest = useMutation({
    mutationFn: (values: FormValues) => api.post('/leave/requests', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
    },
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });

  // Only users with `leave.approve` (HR, HR Manager, Dept Head, Team Lead) can
  // reach this endpoint — we probe it and simply hide the section on 403
  // rather than trying to decode permissions on the client.
  const { data: pendingApprovals, isError: noApprovalAccess } = useQuery({
    queryKey: ['leave', 'approvals'],
    queryFn: () =>
      unwrap<PaginatedResult<LeaveRequest>>(api.get('/leave/requests', { params: { status: 'PENDING', limit: 20 } })),
    retry: false,
  });

  const approveRequest = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });
  const rejectRequest = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.post(`/leave/requests/${id}/reject`, { rejectionReason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave'] }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Leave</h1>

      {balances && balances.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {balances.map((b) => (
            <Card key={b.id}>
              <CardContent className="pt-5">
                <p className="text-xs text-ink-faint">{b.leaveType.name}</p>
                <p className="font-serif text-2xl font-semibold text-ink">
                  {(b.allocated + b.carriedForward - b.used).toFixed(1)}
                </p>
                <p className="text-xs text-ink-faint">days available</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => submitRequest.mutate(values))}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="leaveTypeId">Leave type</Label>
              <select
                id="leaveTypeId"
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                {...register('leaveTypeId')}
              >
                <option value="">Select a leave type…</option>
                {leaveTypes?.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} {lt.requiresApproval ? '' : '(auto-approved)'}
                  </option>
                ))}
              </select>
              <FieldError message={errors.leaveTypeId?.message} />
            </div>

            <div>
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              <FieldError message={errors.startDate?.message} />
            </div>
            <div>
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              <FieldError message={errors.endDate?.message} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" placeholder="Briefly describe the reason" {...register('reason')} />
            </div>

            {submitRequest.isError && (
              <p className="sm:col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(submitRequest.error as any)?.response?.data?.message || 'Could not submit request.'}
              </p>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" isLoading={submitRequest.isPending}>
                Submit request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!noApprovalAccess && pendingApprovals && (
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-responsive">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Dates</th>
                  <th className="py-2 pr-4">Days</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.items.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-ink">
                        {r.employee?.firstName} {r.employee?.lastName}
                      </p>
                      <span className="record-code">{r.employee?.employeeCode}</span>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{r.leaveType.name}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{r.totalDays}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveRequest.mutate(r.id)} isLoading={approveRequest.isPending}>
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const reason = window.prompt('Reason for rejection:');
                            if (reason) rejectRequest.mutate({ id: r.id, rejectionReason: reason });
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingApprovals.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-faint">
                      No pending requests waiting on your approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading requests…</p>}
          {requests && (
            <div className="table-responsive">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Dates</th>
                  <th className="py-2 pr-4">Days</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {requests.items.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-ink">{r.leaveType.name}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{r.totalDays}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {r.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" onClick={() => cancelRequest.mutate(r.id)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-faint">
                      No leave requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
