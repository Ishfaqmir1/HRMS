'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PayrollRun, Payslip, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

export default function PayslipsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createDialog, setCreateDialog] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [runDetail, setRunDetail] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['payroll', 'runs', page],
    queryFn: () => unwrap<PaginatedResult<PayrollRun>>(api.get('/payroll/runs', { params: { page, limit: 20 } })),
  });

  const { data: runPayslips, refetch: refetchPayslips } = useQuery({
    queryKey: ['payroll', 'runs', runDetail, 'payslips'],
    queryFn: () => unwrap<Payslip[]>(api.get(`/payroll/runs/${runDetail}/payslips`)),
    enabled: !!runDetail,
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/payroll/runs', { month, year }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] }); setCreateDialog(false); },
  });

  const processMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/process`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] }); refetchPayslips(); },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] }); setRunDetail(null); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/payslips/${id}/status`, { status: 'APPROVED' }),
    onSuccess: () => refetchPayslips(),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/payslips/${id}/status`, { status: 'PAID' }),
    onSuccess: () => refetchPayslips(),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Payroll Runs & Payslips</h1>
        <Button onClick={() => setCreateDialog(true)}>New Run</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-ink">{MONTHS[run.month - 1]} {run.year}</TableCell>
                      <TableCell>{run.employeeCount}</TableCell>
                      <TableCell>{fmt(run.totalGross)}</TableCell>
                      <TableCell className="text-danger">{fmt(run.totalDeductions)}</TableCell>
                      <TableCell className="text-accent">{fmt(run.totalNet)}</TableCell>
                      <TableCell>
                        <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'DRAFT' ? 'warning' : 'default'}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setRunDetail(run.id); refetchPayslips(); }}>
                            View
                          </Button>
                          {run.status === 'DRAFT' && (
                            <Button variant="ghost" size="sm" onClick={() => processMut.mutate(run.id)} isLoading={processMut.isPending}>
                              Process
                            </Button>
                          )}
                          {run.status === 'DRAFT' && (
                            <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate(run.id)}>Cancel</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* Create Run Dialog */}
      <Dialog open={createDialog} onOpenChange={o => !o && setCreateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Payroll Run</DialogTitle>
            <DialogDescription>Select the month and year to process.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Month</Label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          </div>
          {createMut.isError && (
            <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed to create run.'}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Detail Dialog */}
      <Dialog open={!!runDetail} onOpenChange={o => !o && setRunDetail(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslips</DialogTitle>
            <DialogDescription>All payslips for this payroll run.</DialogDescription>
          </DialogHeader>

          {runPayslips && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runPayslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-ink">{p.employee?.firstName} {p.employee?.lastName}</TableCell>
                    <TableCell>{p.employee?.employeeCode}</TableCell>
                    <TableCell>{fmt(p.grossPay)}</TableCell>
                    <TableCell className="text-danger">{fmt(p.totalDeductions)}</TableCell>
                    <TableCell className="text-accent font-medium">{fmt(p.netPay)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'APPROVED' ? 'default' : 'warning'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === 'DRAFT' && (
                        <Button variant="ghost" size="sm" onClick={() => approveMut.mutate(p.id)}>Approve</Button>
                      )}
                      {p.status === 'APPROVED' && (
                        <Button variant="ghost" size="sm" onClick={() => payMut.mutate(p.id)}>Mark Paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {runPayslips.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-ink-faint">No payslips generated yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button onClick={() => setRunDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
