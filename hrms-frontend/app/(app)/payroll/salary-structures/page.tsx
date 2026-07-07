'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { SalaryStructure, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const formSchema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  basic: z.coerce.number().min(0),
  housingAllowance: z.coerce.number().min(0),
  transportAllowance: z.coerce.number().min(0),
  medicalAllowance: z.coerce.number().min(0),
  otherAllowances: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100),
  pensionPercent: z.coerce.number().min(0).max(100),
  insuranceDeduction: z.coerce.number().min(0),
});
type FormData = z.infer<typeof formSchema>;

function formatCurrency(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

export default function SalaryStructuresPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; data?: SalaryStructure } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'salary-structures', page],
    queryFn: () => unwrap<PaginatedResult<SalaryStructure>>(api.get('/payroll/salary-structures', { params: { page, limit: 20 } })),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { basic: 0, housingAllowance: 0, transportAllowance: 0, medicalAllowance: 0, otherAllowances: 0, taxPercent: 0, pensionPercent: 0, insuranceDeduction: 0 },
  });

  const saveMut = useMutation({
    mutationFn: (values: FormData) => {
      if (dialog?.mode === 'edit' && dialog.data) {
        return api.patch(`/payroll/salary-structures/${dialog.data.id}`, values);
      }
      return api.post('/payroll/salary-structures', values);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'salary-structures'] }); setDialog(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/salary-structures/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'salary-structures'] }),
  });

  function openCreate() {
    reset({ name: '', description: '', basic: 0, housingAllowance: 0, transportAllowance: 0, medicalAllowance: 0, otherAllowances: 0, taxPercent: 0, pensionPercent: 0, insuranceDeduction: 0 });
    setDialog({ mode: 'create' });
  }

  function openEdit(s: SalaryStructure) {
    reset({
      name: s.name, description: s.description || '', basic: s.basic, housingAllowance: s.housingAllowance,
      transportAllowance: s.transportAllowance, medicalAllowance: s.medicalAllowance, otherAllowances: s.otherAllowances,
      taxPercent: s.taxPercent, pensionPercent: s.pensionPercent, insuranceDeduction: s.insuranceDeduction,
    });
    setDialog({ mode: 'edit', data: s });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Salary Structures</h1>
        <Button onClick={openCreate}><Plus size={14} /> Create</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading…</p>}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Housing</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>Medical</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => {
                    const gross = s.basic + s.housingAllowance + s.transportAllowance + s.medicalAllowance + s.otherAllowances;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-ink">{s.name}</TableCell>
                        <TableCell>{formatCurrency(s.basic)}</TableCell>
                        <TableCell>{formatCurrency(s.housingAllowance)}</TableCell>
                        <TableCell>{formatCurrency(s.transportAllowance)}</TableCell>
                        <TableCell>{formatCurrency(s.medicalAllowance)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(gross)}</TableCell>
                        <TableCell>{s.taxPercent}%</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil size={12} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(s.id)}><Trash2 size={12} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit' : 'Create'} Salary Structure</DialogTitle>
            <DialogDescription>Define the salary components for this template.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => saveMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input {...register('name')} placeholder="Standard" />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Standard employee salary template" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Basic</Label><Input type="number" {...register('basic')} /></div>
              <div><Label>Housing Allowance</Label><Input type="number" {...register('housingAllowance')} /></div>
              <div><Label>Transport Allowance</Label><Input type="number" {...register('transportAllowance')} /></div>
              <div><Label>Medical Allowance</Label><Input type="number" {...register('medicalAllowance')} /></div>
              <div><Label>Other Allowances</Label><Input type="number" {...register('otherAllowances')} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Tax (%)</Label><Input type="number" step="0.1" {...register('taxPercent')} /></div>
              <div><Label>Pension (%)</Label><Input type="number" step="0.1" {...register('pensionPercent')} /></div>
              <div><Label>Insurance ($)</Label><Input type="number" {...register('insuranceDeduction')} /></div>
            </div>

            {saveMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMut.error as any)?.response?.data?.message || 'Save failed.'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" isLoading={saveMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
