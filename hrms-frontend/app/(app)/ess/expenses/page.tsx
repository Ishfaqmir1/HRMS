'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Reimbursement, ReimbursementCategory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning', APPROVED: 'default', REJECTED: 'danger', PAID: 'success',
};

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

const createSchema = z.object({
  categoryId: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

export default function ExpenseClaimsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['me', 'expenses'],
    queryFn: () => unwrap<Reimbursement[]>(api.get('/me/expenses')),
  });

  const { data: categories } = useQuery({
    queryKey: ['payroll', 'reimbursement-categories'],
    queryFn: () => unwrap<ReimbursementCategory[]>(api.get('/payroll/reimbursement-categories')),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => api.post('/me/expenses', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'expenses'] });
      setCreateOpen(false);
      reset();
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Expense Claims</h1>
        <Button onClick={() => setCreateOpen(true)}>New Claim</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>My Claims</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading claims…</p>}
          {expenses && expenses.length === 0 && (
            <p className="text-sm text-ink-faint">No expense claims yet.</p>
          )}
          {expenses && expenses.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><Badge variant="default">{e.category?.name || '—'}</Badge></TableCell>
                    <TableCell className="font-medium text-ink">{fmt(e.amount)}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-ink-soft">{e.description || '—'}</TableCell>
                    <TableCell><Badge tone={STATUS_TONES[e.status]}>{e.status}</Badge></TableCell>
                    <TableCell className="text-ink-faint">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Expense Claim</DialogTitle>
            <DialogDescription>Submit an expense for reimbursement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => createMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Category</Label>
              <select {...register('categoryId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select category…</option>
                {categories?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.maxAmount ? ` (max ${fmt(c.maxAmount)})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" {...register('amount')} />
            </div>
            <div>
              <Label>Description</Label>
              <Input {...register('description')} placeholder="e.g. Client meeting dinner" />
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
