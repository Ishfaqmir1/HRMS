'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, unwrap } from '@/lib/api-client';
import { Reimbursement, ReimbursementCategory, Employee, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const createSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  categoryId: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

const STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning', APPROVED: 'default', REJECTED: 'danger', PAID: 'success',
};

export default function ReimbursementsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['payroll', 'reimbursements', page],
    queryFn: () => unwrap<PaginatedResult<Reimbursement>>(api.get('/payroll/reimbursements', { params: { page, limit: 20 } })),
  });

  const { data: categories } = useQuery({
    queryKey: ['payroll', 'reimbursement-categories'],
    queryFn: () => unwrap<ReimbursementCategory[]>(api.get('/payroll/reimbursement-categories')),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => unwrap<PaginatedResult<Employee>>(api.get('/employees', { params: { limit: 200 } })),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => api.post('/payroll/reimbursements', v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'reimbursements'] }); setCreateOpen(false); reset(); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/reimbursements/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'reimbursements'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/payroll/reimbursements/${id}/reject`, { reason }, { params: { reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'reimbursements'] }),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/reimbursements/${id}/paid`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'reimbursements'] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Reimbursements</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            reset({ employeeId: '', categoryId: '', amount: 0, description: '' });
            setCreateOpen(true);
          }}>New Request</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-ink">{r.employee?.firstName} {r.employee?.lastName}</TableCell>
                    <TableCell><Badge variant="default">{r.category?.name || '—'}</Badge></TableCell>
                    <TableCell className="font-medium">{fmt(r.amount)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-ink-soft">{r.description || '—'}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === 'PENDING' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => approveMut.mutate(r.id)}>Approve</Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              const reason = window.prompt('Reason for rejection:');
                              if (reason) rejectMut.mutate({ id: r.id, reason });
                            }}>Reject</Button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <Button variant="ghost" size="sm" onClick={() => payMut.mutate(r.id)}>Mark Paid</Button>
                        )}
                      </div>
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

      {/* Create Reimbursement Dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Reimbursement</DialogTitle>
            <DialogDescription>Submit a reimbursement request for an employee.</DialogDescription>
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
              <Label>Category</Label>
              <select {...register('categoryId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select category…</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.maxAmount ? ` (max ${fmt(c.maxAmount)})` : ''}</option>
                ))}
              </select>
              <FieldError message={errors.categoryId?.message} />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" {...register('amount')} />
              <FieldError message={errors.amount?.message} />
            </div>
            <div>
              <Label>Description</Label>
              <Input {...register('description')} placeholder="e.g. Client meeting taxi fare" />
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
    </div>
  );
}
