'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, unwrap } from '@/lib/api-client';
import { EmployeeSalary, Employee, SalaryStructure, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const formSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  structureId: z.string().optional(),
  effectiveFrom: z.string().min(1, 'Required'),
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

export default function EmployeeSalariesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ mode: 'create'; selectedEmployee?: Employee } | null>(null);

  const { data } = useQuery({
    queryKey: ['payroll', 'employee-salaries', page],
    queryFn: () => unwrap<PaginatedResult<EmployeeSalary>>(api.get('/payroll/employee-salaries', { params: { page, limit: 20 } })),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => unwrap<PaginatedResult<Employee>>(api.get('/employees', { params: { limit: 200 } })),
  });

  const { data: structures } = useQuery({
    queryKey: ['payroll', 'salary-structures', 'all'],
    queryFn: () => unwrap<PaginatedResult<SalaryStructure>>(api.get('/payroll/salary-structures', { params: { limit: 50 } })),
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { basic: 0, housingAllowance: 0, transportAllowance: 0, otherAllowances: 0, medicalAllowance: 0, taxPercent: 0, pensionPercent: 0, insuranceDeduction: 0, effectiveFrom: new Date().toISOString().split('T')[0] },
  });

  const structureId = watch('structureId');

  function applyStructure(id: string) {
    const s = structures?.items.find(st => st.id === id);
    if (s) {
      setValue('basic', s.basic);
      setValue('housingAllowance', s.housingAllowance);
      setValue('transportAllowance', s.transportAllowance);
      setValue('medicalAllowance', s.medicalAllowance);
      setValue('otherAllowances', s.otherAllowances);
      setValue('taxPercent', s.taxPercent);
      setValue('pensionPercent', s.pensionPercent);
      setValue('insuranceDeduction', s.insuranceDeduction);
    }
  }

  const saveMut = useMutation({
    mutationFn: (values: FormData) => api.post('/payroll/employee-salaries', values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'employee-salaries'] }); setDialog(null); },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Employee Salaries</h1>
        <Button onClick={() => {
          reset({ employeeId: '', structureId: '', effectiveFrom: new Date().toISOString().split('T')[0], basic: 0, housingAllowance: 0, transportAllowance: 0, medicalAllowance: 0, otherAllowances: 0, taxPercent: 0, pensionPercent: 0, insuranceDeduction: 0 });
          setDialog({ mode: 'create' });
        }}>Assign Salary</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Net (approx)</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((es) => {
                  const gross = es.basic + es.housingAllowance + es.transportAllowance + es.medicalAllowance + es.otherAllowances;
                  const deductions = gross * (es.taxPercent + es.pensionPercent) / 100 + es.insuranceDeduction;
                  const net = Math.max(gross - deductions, 0);
                  return (
                    <TableRow key={es.id}>
                      <TableCell className="font-medium text-ink">
                        {es.employee?.firstName} {es.employee?.lastName}
                        <span className="ml-2 text-xs text-ink-faint">{es.employee?.employeeCode}</span>
                      </TableCell>
                      <TableCell className="text-ink-soft">{es.employee?.designation?.title || '—'}</TableCell>
                      <TableCell>{formatCurrency(es.basic)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(gross)}</TableCell>
                      <TableCell className="text-accent">{formatCurrency(net)}</TableCell>
                      <TableCell className="text-ink-soft text-xs">{new Date(es.effectiveFrom).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={es.isActive ? 'success' : 'warning'}>{es.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Salary</DialogTitle>
            <DialogDescription>Set up an employee&apos;s salary. Select a structure to pre-fill values.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => saveMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Employee</Label>
              <select {...register('employeeId')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select employee...</option>
                {employees?.items.filter(e => e.status === 'ACTIVE').map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                ))}
              </select>
              <FieldError message={errors.employeeId?.message} />
            </div>
            <div>
              <Label>Use template (optional)</Label>
              <select value={structureId || ''} onChange={e => { setValue('structureId', e.target.value); if (e.target.value) applyStructure(e.target.value); }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Manual entry...</option>
                {structures?.items.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Effective from</Label>
              <Input type="date" {...register('effectiveFrom')} />
              <FieldError message={errors.effectiveFrom?.message} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Basic</Label><Input type="number" {...register('basic')} /></div>
              <div><Label>Housing</Label><Input type="number" {...register('housingAllowance')} /></div>
              <div><Label>Transport</Label><Input type="number" {...register('transportAllowance')} /></div>
              <div><Label>Medical</Label><Input type="number" {...register('medicalAllowance')} /></div>
              <div><Label>Other</Label><Input type="number" {...register('otherAllowances')} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Tax %</Label><Input type="number" step="0.1" {...register('taxPercent')} /></div>
              <div><Label>Pension %</Label><Input type="number" step="0.1" {...register('pensionPercent')} /></div>
              <div><Label>Insurance $</Label><Input type="number" {...register('insuranceDeduction')} /></div>
            </div>

            {saveMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMut.error as any)?.response?.data?.message || 'Save failed.'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" isLoading={saveMut.isPending}>Assign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
