'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface TaxDeclaration {
  id: string;
  financialYear: string;
  panNumber: string | null;
  declarations: Record<string, any> | null;
  totalIncome: number | null;
  totalDeductions: number | null;
  totalTaxPaid: number | null;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  submittedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_TONES: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default', SUBMITTED: 'warning', VERIFIED: 'success', REJECTED: 'danger',
};

const createSchema = z.object({
  financialYear: z.string().min(1, 'Required'),
  panNumber: z.string().optional(),
  totalIncome: z.coerce.number().optional(),
  totalDeductions: z.coerce.number().optional(),
  totalTaxPaid: z.coerce.number().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function fmt(v: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
}

export default function TaxDeclarationsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<TaxDeclaration | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'tax-declarations'],
    queryFn: () => unwrap<TaxDeclaration[]>(api.get('/me/tax-declarations')),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => api.post('/tax-declarations', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'tax-declarations'] });
      setCreateOpen(false);
      reset();
    },
  });

  const submitMut = useMutation({
    mutationFn: (financialYear: string) => api.post(`/tax-declarations/${financialYear}/submit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'tax-declarations'] }),
  });

  const currentYear = new Date().getFullYear();
  const defaultYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Tax Declarations</h1>
        <Button onClick={() => { reset({ financialYear: defaultYear }); setCreateOpen(true); }}>
          New Declaration
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Your Declarations</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading…</p>}
          {data && data.length === 0 && (
            <p className="text-sm text-ink-faint">No tax declarations yet. Create one for the current financial year.</p>
          )}
          {data && data.length > 0 && (
            <div className="space-y-3">
              {data.map((td) => (
                <div key={td.id} className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="font-medium text-ink">FY {td.financialYear}</p>
                    <p className="text-sm text-ink-soft">
                      Income: {fmt(td.totalIncome)} · Deductions: {fmt(td.totalDeductions)} · Tax: {fmt(td.totalTaxPaid)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS_TONES[td.status]}>{td.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setDetail(td)}>View</Button>
                    {td.status === 'DRAFT' && (
                      <Button variant="ghost" size="sm" onClick={() => submitMut.mutate(td.financialYear)}>Submit</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Tax Declaration</DialogTitle>
            <DialogDescription>Enter your tax details for the financial year.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => createMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Financial Year</Label>
              <Input {...register('financialYear')} placeholder="e.g. 2025-26" />
            </div>
            <div>
              <Label>PAN Number (optional)</Label>
              <Input {...register('panNumber')} placeholder="e.g. ABCDE1234F" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Income</Label>
                <Input type="number" {...register('totalIncome')} />
              </div>
              <div>
                <Label>Total Deductions</Label>
                <Input type="number" {...register('totalDeductions')} />
              </div>
            </div>
            <div>
              <Label>Tax Paid</Label>
              <Input type="number" {...register('totalTaxPaid')} />
            </div>
            {createMut.isError && (
              <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed.'}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tax Declaration — FY {detail?.financialYear}</DialogTitle>
            <DialogDescription>Status: {detail?.status}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-faint">PAN</span><span className="text-ink">{detail.panNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Income</span><span className="text-ink">{fmt(detail.totalIncome)}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Deductions</span><span className="text-accent">{fmt(detail.totalDeductions)}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Tax Paid</span><span className="text-ink">{fmt(detail.totalTaxPaid)}</span></div>
              {detail.submittedAt && (
                <div className="flex justify-between"><span className="text-ink-faint">Submitted</span><span className="text-ink">{new Date(detail.submittedAt).toLocaleDateString()}</span></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
