'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, unwrap } from '@/lib/api-client';
import { Loan, Employee, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const createSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  loanType: z.enum(['PERSONAL', 'ADVANCE', 'EMERGENCY']),
  amount: z.coerce.number().min(1, 'Amount must be > 0'),
  interestRate: z.coerce.number().min(0).max(100).default(0),
  repaymentMonths: z.coerce.number().int().min(1).max(60),
  purpose: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

const STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning', APPROVED: 'default', ACTIVE: 'success', COMPLETED: 'success', REJECTED: 'danger', CANCELLED: 'danger',
};

export default function LoansPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [approveDialog, setApproveDialog] = useState<Loan | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Loan | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data } = useQuery({
    queryKey: ['payroll', 'loans', page],
    queryFn: () => unwrap<PaginatedResult<Loan>>(api.get('/payroll/loans', { params: { page, limit: 20 } })),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => unwrap<PaginatedResult<Employee>>(api.get('/employees', { params: { limit: 200 } })),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { loanType: 'PERSONAL', interestRate: 0, repaymentMonths: 6 },
  });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => api.post('/payroll/loans', v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'loans'] }); setCreateOpen(false); reset(); },
  });

  const approveMut = useMutation({
    mutationFn: ({ id, disbursedAt }: { id: string; disbursedAt: string }) => api.post(`/payroll/loans/${id}/approve`, { disbursedAt }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'loans'] }); setApproveDialog(null); },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/payroll/loans/${id}/reject`, { reason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'loans'] }); setRejectDialog(null); setRejectReason(''); },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Loans</h1>
        <Button onClick={() => setCreateOpen(true)}>Request Loan</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium text-ink">{loan.employee?.firstName} {loan.employee?.lastName}</TableCell>
                    <TableCell><Badge variant="default">{loan.loanType}</Badge></TableCell>
                    <TableCell>{fmt(loan.amount)}</TableCell>
                    <TableCell>{fmt(loan.totalAmount)}</TableCell>
                    <TableCell>{fmt(loan.monthlyInstallment)}</TableCell>
                    <TableCell className="text-ink-soft">{loan.repaymentMonths}mo</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[loan.status]}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.status === 'PENDING' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setApproveDialog(loan)}>Approve</Button>
                          <Button variant="ghost" size="sm" onClick={() => { setRejectDialog(loan); setRejectReason(''); }}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
            <span>Page {data?.meta.page || 1} of {Math.max(data?.meta.totalPages || 1, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Loan Dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Loan</DialogTitle>
            <DialogDescription>Create a new loan or advance for an employee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => createMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Employee</Label>
              <select {...register('employeeId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select employee…</option>
                {employees?.items.filter(e => e.status === 'ACTIVE').map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                ))}
              </select>
              <FieldError message={errors.employeeId?.message} />
            </div>
            <div>
              <Label>Type</Label>
              <select {...register('loanType')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="PERSONAL">Personal Loan</option>
                <option value="ADVANCE">Salary Advance</option>
                <option value="EMERGENCY">Emergency Loan</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" {...register('amount')} />
                <FieldError message={errors.amount?.message} />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input type="number" step="0.1" {...register('interestRate')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Repayment (months)</Label>
                <Input type="number" {...register('repaymentMonths')} />
                <FieldError message={errors.repaymentMonths?.message} />
              </div>
              <div>
                <Label>Purpose</Label>
                <Input {...register('purpose')} placeholder="Optional" />
              </div>
            </div>
            {createMut.isError && (
              <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed.'}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMut.isPending}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve Loan Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Loan</DialogTitle>
            <DialogDescription>{approveDialog?.employee?.firstName} {approveDialog?.employee?.lastName} · {fmt(approveDialog?.amount || 0)}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Disbursement date</Label>
            <Input type="date" id="disbursedAt" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button onClick={() => {
              const d = (document.getElementById('disbursedAt') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
              approveMut.mutate({ id: approveDialog!.id, disbursedAt: d });
            }} isLoading={approveMut.isPending}>Approve &amp; Generate Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Loan</DialogTitle>
            <DialogDescription>Provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason</Label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMut.mutate({ id: rejectDialog!.id, reason: rejectReason })} isLoading={rejectMut.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
