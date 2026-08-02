'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PayrollRun, Payslip, PaginatedResult, PayrollRunVersion, PayslipCompare } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  History, RotateCcw, GitCompare, ArrowUp, ArrowDown, Minus, FileText,
} from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

const PAYSLIP_FIELDS: { key: keyof Payslip; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'housingAllowance', label: 'Housing' },
  { key: 'transportAllowance', label: 'Transport' },
  { key: 'medicalAllowance', label: 'Medical' },
  { key: 'otherAllowances', label: 'Other Allowances' },
  { key: 'overtimePay', label: 'Overtime Pay' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'grossPay', label: 'Gross Pay' },
  { key: 'taxDeduction', label: 'Tax' },
  { key: 'pensionDeduction', label: 'Pension' },
  { key: 'insuranceDeduction', label: 'Insurance' },
  { key: 'loanDeduction', label: 'Loan' },
  { key: 'otherDeductions', label: 'Other Deductions' },
  { key: 'totalDeductions', label: 'Total Deductions' },
  { key: 'netPay', label: 'Net Pay' },
];

export default function PayslipsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createDialog, setCreateDialog] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [runDetail, setRunDetail] = useState<string | null>(null);
  const [recalcDialog, setRecalcDialog] = useState<string | null>(null);
  const [recalcReason, setRecalcReason] = useState('');
  const [versionsDialog, setVersionsDialog] = useState<string | null>(null);
  const [compareDialog, setCompareDialog] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<PayslipCompare | null>(null);

  // ---- Queries ----
  const { data } = useQuery({
    queryKey: ['payroll', 'runs', page],
    queryFn: () => unwrap<PaginatedResult<PayrollRun>>(api.get('/payroll/runs', { params: { page, limit: 20 } })),
  });

  const { data: runPayslips, refetch: refetchPayslips } = useQuery({
    queryKey: ['payroll', 'runs', runDetail, 'payslips'],
    queryFn: () => unwrap<Payslip[]>(api.get(`/payroll/runs/${runDetail}/payslips`)),
    enabled: !!runDetail,
  });

  const { data: versions } = useQuery({
    queryKey: ['payroll', 'versions', versionsDialog],
    queryFn: () => unwrap<PayrollRunVersion[]>(api.get(`/payroll/runs/${versionsDialog}/versions`)),
    enabled: !!versionsDialog,
  });

  // ---- Mutations ----
  const createMut = useMutation({
    mutationFn: () => api.post('/payroll/runs', { month, year }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] }); setCreateDialog(false); },
  });

  const processMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      refetchPayslips();
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      setRunDetail(null);
    },
  });

  const recalcMut = useMutation({
    mutationFn: (id: string) =>
      api.post(`/payroll/runs/${id}/recalculate`, { reason: recalcReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'versions'] });
      setRecalcDialog(null);
      setRecalcReason('');
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/payslips/${id}/status`, { status: 'APPROVED' }),
    onSuccess: () => refetchPayslips(),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/payslips/${id}/status`, { status: 'PAID' }),
    onSuccess: () => refetchPayslips(),
  });

  // ---- Handlers ----
  const openCompare = async (payslipId: string) => {
    try {
      const result = await unwrap<PayslipCompare>(api.get(`/payroll/payslips/${payslipId}/compare`));
      setCompareData(result);
      setCompareDialog(payslipId);
    } catch {
      // silently fail
    }
  };

  // ---- Helpers ----
  const versionBadge = (status: string) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'DRAFT') return 'warning';
    return 'default';
  };

  // Extracted helper to avoid re-creating component on each render
  function DiffIcon({ diff }: { diff: number }) {
    if (diff > 0) return <ArrowUp size={14} className="text-accent" />;
    if (diff < 0) return <ArrowDown size={14} className="text-danger" />;
    return <Minus size={14} className="text-ink-faint" />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Payroll Runs &amp; Payslips</h1>
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
                    <TableHead className="w-20">Ver.</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-56">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-ink">{MONTHS[run.month - 1]} {run.year}</TableCell>
                      <TableCell className="text-ink-faint text-xs">{(run as any).version ?? 1}</TableCell>
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
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => { setRunDetail(run.id); refetchPayslips(); }}>
                            View
                          </Button>
                          {(run as any).version >= 1 && (
                            <Button variant="ghost" size="sm" onClick={() => setVersionsDialog(run.id)} title="View all versions">
                              <History size={14} />
                            </Button>
                          )}
                          {run.status === 'COMPLETED' && (
                            <Button variant="ghost" size="sm" onClick={() => { setRecalcDialog(run.id); setRecalcReason(''); }} title="Recalculate">
                              <RotateCcw size={14} />
                            </Button>
                          )}
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

      {/* ================================================================ */}
      {/* CREATE RUN DIALOG                                               */}
      {/* ================================================================ */}
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

      {/* ================================================================ */}
      {/* RUN DETAIL — PAYSLIPS                                          */}
      {/* ================================================================ */}
      <Dialog open={!!runDetail} onOpenChange={o => !o && setRunDetail(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openCompare(p.id)} title="Compare with previous version">
                          <GitCompare size={14} />
                        </Button>
                        {p.status === 'DRAFT' && (
                          <Button variant="ghost" size="sm" onClick={() => approveMut.mutate(p.id)}>Approve</Button>
                        )}
                        {p.status === 'APPROVED' && (
                          <Button variant="ghost" size="sm" onClick={() => payMut.mutate(p.id)}>Mark Paid</Button>
                        )}
                      </div>
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

      {/* ================================================================ */}
      {/* RECALCULATE DIALOG                                             */}
      {/* ================================================================ */}
      <Dialog open={!!recalcDialog} onOpenChange={o => !o && setRecalcDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate Payroll Run</DialogTitle>
            <DialogDescription>
              This will create a new version of this payroll run with updated calculations.
              The original run will not be modified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Reason for recalculation *</Label>
              <textarea
                value={recalcReason}
                onChange={e => setRecalcReason(e.target.value)}
                placeholder="e.g., Overtime correction for Engineering team"
                className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="rounded-lg bg-amber-soft/40 border border-amber/20 px-4 py-3">
              <div className="flex items-start gap-2">
                <RotateCcw size={16} className="mt-0.5 text-amber shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber">What happens?</p>
                  <ul className="mt-1 text-xs text-amber/80 space-y-0.5 list-disc list-inside">
                    <li>A new DRAFT version will be created</li>
                    <li>Payslips will be recalculated with current salary data</li>
                    <li>Overtime will be recomputed from attendance records</li>
                    <li>The original run and payslips remain unchanged</li>
                    <li>Review the new version before approving</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {recalcMut.isError && (
            <p className="text-sm text-danger">
              {(recalcMut.error as any)?.response?.data?.message || 'Recalculation failed.'}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecalcDialog(null)}>Cancel</Button>
            <Button
              onClick={() => recalcDialog && recalcMut.mutate(recalcDialog)}
              isLoading={recalcMut.isPending}
              disabled={!recalcReason.trim()}
            >
              Create Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* VERSION HISTORY DIALOG                                         */}
      {/* ================================================================ */}
      <Dialog open={!!versionsDialog} onOpenChange={o => !o && setVersionsDialog(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              All versions of this payroll period. Each recalculation creates a new version.
            </DialogDescription>
          </DialogHeader>

          {versions && (
            <div className="space-y-4">
              {versions.map((v, idx) => {
                const isLatest = idx === 0;
                return (
                  <div
                    key={v.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isLatest
                        ? 'border-accent/30 bg-accent/[0.03] ring-1 ring-accent/10'
                        : 'border-border bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isLatest ? 'bg-accent text-white' : 'bg-paper text-ink-faint'
                        }`}>
                          <span className="font-serif font-semibold">v{v.version}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-ink">
                              Version {v.version}
                              {isLatest && <span className="ml-2 text-xs font-normal text-accent">(latest)</span>}
                            </p>
                            <Badge variant={versionBadge(v.status) as any}>{v.status}</Badge>
                          </div>
                          {v.recalcReason && (
                            <p className="mt-0.5 text-xs text-ink-faint">{v.recalcReason}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-ink-faint">
                        <p>{v.processedAt ? new Date(v.processedAt).toLocaleDateString() : 'Not processed'}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      <div className="rounded-lg bg-paper px-3 py-2 text-center">
                        <p className="text-xs text-ink-faint">Employees</p>
                        <p className="font-medium text-ink">{v.employeeCount}</p>
                      </div>
                      <div className="rounded-lg bg-paper px-3 py-2 text-center">
                        <p className="text-xs text-ink-faint">Gross</p>
                        <p className="font-medium text-ink">{fmt(v.totalGross)}</p>
                      </div>
                      <div className="rounded-lg bg-paper px-3 py-2 text-center">
                        <p className="text-xs text-ink-faint">Net</p>
                        <p className="font-medium text-accent">{fmt(v.totalNet)}</p>
                      </div>
                      <div className="rounded-lg bg-paper px-3 py-2 text-center">
                        <p className="text-xs text-ink-faint">Action</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setVersionsDialog(null); setRunDetail(v.id); refetchPayslips(); }}
                          className="text-xs"
                        >
                          View Payslips
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {versions.length === 0 && (
                <p className="py-8 text-center text-sm text-ink-faint">No version history available.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setVersionsDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* PAYSLIP COMPARISON DIALOG                                     */}
      {/* ================================================================ */}
      <Dialog open={!!compareDialog} onOpenChange={(o) => { if (!o) { setCompareDialog(null); setCompareData(null); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip Comparison</DialogTitle>
            <DialogDescription>
              {compareData?.current?.employee?.firstName} {compareData?.current?.employee?.lastName}
              {compareData?.current?.run && ` — v${(compareData?.current as any).run?.version ?? '?'}`}
              {compareData?.previous && ` vs v${(compareData?.previous as any).run?.version ?? '?'}`}
            </DialogDescription>
          </DialogHeader>

          {compareData && (
            <>
              {!compareData.previous ? (
                <div className="rounded-lg bg-accent/[0.04] border border-accent/10 px-4 py-6 text-center">
                  <FileText size={24} className="mx-auto mb-2 text-ink-faint" />
                  <p className="text-sm text-ink-faint">This is the original payslip. No previous version to compare against.</p>
                </div>
              ) : compareData.differences && Object.keys(compareData.differences).length > 0 ? (
                <div className="space-y-1">
                  {/* Summary banner */}
                  <div className="mb-4 rounded-lg bg-accent/[0.04] border border-accent/10 px-4 py-3">
                    <p className="text-sm text-ink-soft">
                      <span className="font-medium text-ink">{Object.keys(compareData.differences).length} fields changed</span>
                      {' · '}
                      Net change: <span className={`font-medium ${(compareData.differences.netPay?.diff ?? 0) >= 0 ? 'text-accent' : 'text-danger'}`}>
                        {fmt(compareData.differences.netPay?.diff ?? 0)}
                      </span>
                    </p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead className="text-right">Previous</TableHead>
                        <TableHead className="text-center"></TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PAYSLIP_FIELDS.map(({ key, label }) => {
                        const diff = compareData.differences?.[key];
                        if (!diff) return null;
                        return (
                          <TableRow key={key}>
                            <TableCell className="font-medium text-ink">{label}</TableCell>
                            <TableCell className="text-right text-ink-faint">{fmt(diff.from)}</TableCell>
                            <TableCell className="text-center">
                              <DiffIcon diff={diff.diff} />
                            </TableCell>
                            <TableCell className="text-right font-medium text-ink">{fmt(diff.to)}</TableCell>
                            <TableCell className={`text-right font-medium tabular-nums ${
                              diff.diff > 0 ? 'text-accent' : diff.diff < 0 ? 'text-danger' : 'text-ink-faint'
                            }`}>
                              {diff.diff > 0 ? '+' : ''}{diff.diff.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg bg-accent/[0.04] border border-accent/10 px-4 py-6 text-center">
                  <Minus size={24} className="mx-auto mb-2 text-ink-faint" />
                  <p className="text-sm text-ink-faint">No differences found between versions.</p>
                </div>
              )}

              {/* Adjustments metadata */}
              {(compareData.current as any).adjustments && (
                <div className="mt-4 rounded-lg bg-amber-soft/30 border border-amber/10 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint mb-1">Adjustments Applied</p>
                  <pre className="text-xs text-ink-soft whitespace-pre-wrap font-mono">
                    {JSON.stringify((compareData.current as any).adjustments, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button onClick={() => { setCompareDialog(null); setCompareData(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
