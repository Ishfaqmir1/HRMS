'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, Payslip } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

export default function PayslipsPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Payslip | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'payslips', page],
    queryFn: () => unwrap<PaginatedResult<Payslip>>(api.get('/me/payslips', { params: { page, limit: 20 } })),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">My Payslips</h1>

      <Card>
        <CardHeader><CardTitle>Payslip History</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading payslips…</p>}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-ink">
                        {p.run ? `${MONTHS[p.run.month - 1]} ${p.run.year}` : '—'}
                      </TableCell>
                      <TableCell>{fmt(p.grossPay)}</TableCell>
                      <TableCell className="text-danger">{fmt(p.totalDeductions)}</TableCell>
                      <TableCell className="text-accent font-medium">{fmt(p.netPay)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'APPROVED' ? 'default' : 'warning'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(p)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-ink-faint">No payslips yet.</TableCell></TableRow>
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

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payslip Details</DialogTitle>
            <DialogDescription>
              {selected?.run ? `${MONTHS[selected.run.month - 1]} ${selected.run.year}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-2 text-sm font-medium text-ink-faint uppercase tracking-wide">Earnings</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Basic</dt><dd>{fmt(selected.basic)}</dd></div>
                  <div className="flex justify-between"><dt>Housing</dt><dd>{fmt(selected.housingAllowance)}</dd></div>
                  <div className="flex justify-between"><dt>Transport</dt><dd>{fmt(selected.transportAllowance)}</dd></div>
                  <div className="flex justify-between"><dt>Medical</dt><dd>{fmt(selected.medicalAllowance)}</dd></div>
                  <div className="flex justify-between"><dt>Other Allowances</dt><dd>{fmt(selected.otherAllowances)}</dd></div>
                  {selected.overtimePay > 0 && <div className="flex justify-between"><dt>Overtime</dt><dd>{fmt(selected.overtimePay)}</dd></div>}
                  {selected.bonus > 0 && <div className="flex justify-between"><dt>Bonus</dt><dd>{fmt(selected.bonus)}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-1 font-medium"><dt>Gross</dt><dd>{fmt(selected.grossPay)}</dd></div>
                </dl>
              </div>
              <div className="rounded-md border border-border p-4">
                <h4 className="mb-2 text-sm font-medium text-ink-faint uppercase tracking-wide">Deductions</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Tax</dt><dd>{fmt(selected.taxDeduction)}</dd></div>
                  <div className="flex justify-between"><dt>Pension</dt><dd>{fmt(selected.pensionDeduction)}</dd></div>
                  <div className="flex justify-between"><dt>Insurance</dt><dd>{fmt(selected.insuranceDeduction)}</dd></div>
                  {selected.loanDeduction > 0 && <div className="flex justify-between"><dt>Loan</dt><dd>{fmt(selected.loanDeduction)}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-1 font-medium"><dt>Total Deductions</dt><dd className="text-danger">{fmt(selected.totalDeductions)}</dd></div>
                </dl>
              </div>
              <div className="flex justify-between rounded-md bg-accent-soft p-4 text-sm">
                <span className="font-medium text-accent">Net Pay</span>
                <span className="font-serif text-xl font-semibold text-accent">{fmt(selected.netPay)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
