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
import { Download, Loader2, Printer, TrendingUp, TrendingDown, Archive } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(v: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v);
}

async function downloadPayslip(payslipId: string, filename: string) {
  const response = await api.get(`/me/payslips/${payslipId}/pdf`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function PayComparison({ label, current, previous }: {
  label: string;
  current: number;
  previous: number | undefined;
}) {
  const diff = previous ? current - previous : 0;
  const pct = previous && previous !== 0 ? ((diff / previous) * 100).toFixed(1) : null;
  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-sm text-ink">{label}</td>
      <td className="px-4 py-2.5 text-sm text-right font-medium">{fmt(current)}</td>
      {previous !== undefined && (
        <td className="px-4 py-2.5 text-sm text-right font-medium">{fmt(previous)}</td>
      )}
      {previous !== undefined && (
        <td className={`px-4 py-2.5 text-sm text-right font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-ink-faint'}`}>
          {diff === 0 ? '—' : (
            <span className="inline-flex items-center gap-1">
              {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {fmt(diff)} {pct && `(${pct}%)`}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

/** Group payslips by year for the comparison view */
function groupByYear(payslips: Payslip[]) {
  const groups: { year: number; payslips: Payslip[] }[] = [];
  for (const p of payslips) {
    const year = p.run?.year ?? 0;
    let group = groups.find((g) => g.year === year);
    if (!group) {
      group = { year, payslips: [] };
      groups.push(group);
    }
    group.payslips.push(p);
  }
  return groups.sort((a, b) => b.year - a.year);
}

export default function PayslipsPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'payslips', page],
    queryFn: () => unwrap<PaginatedResult<Payslip>>(api.get('/me/payslips', { params: { page, limit: 20 } })),
  });

  // Fetch all payslips for comparison (unlimited for lookups across months)
  const { data: allData } = useQuery({
    queryKey: ['me', 'payslips', 'all'],
    queryFn: () => unwrap<PaginatedResult<Payslip>>(api.get('/me/payslips', { params: { page: 1, limit: 200 } })),
  });

  // Build previous-payslip lookup for comparison (from all data)
  const prevByMonth = new Map<string, Payslip>();
  const allItems = allData?.items ?? [];
  for (const p of allItems) {
    if (p.run) {
      const key = `${p.run.year}-${p.run.month}`;
      prevByMonth.set(key, p);
    }
  }

  const handleDownload = async (p: Payslip) => {
    const period = p.run ? `${MONTHS_SHORT[p.run.month - 1]}-${p.run.year}` : 'payslip';
    const filename = `payslip-${period.toLowerCase()}.pdf`;
    setDownloadingId(p.id);
    try {
      await downloadPayslip(p.id, filename);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSelected = () => {
    if (selected) handleDownload(selected);
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const response = await api.get('/me/payslips/download-all', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-payslips.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download all payslips:', err);
    } finally {
      setDownloadingAll(false);
    }
  };

  const handlePrint = () => {
    if (!selected) return;
    // Open a minimal print window
    const win = window.open('', '_blank');
    if (!win) return;
    const period = selected.run
      ? `${MONTHS[selected.run.month - 1]} ${selected.run.year}`
      : '';
    const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Payslip - ${period}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #1a1a2e; }
        .company-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 2px solid #0B6E63; padding-bottom: 12px; }
        .company-logo { width: 44px; height: 44px; background: #0B6E63; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold; flex-shrink: 0; }
        h1 { font-size: 22px; color: #0B6E63; margin: 0; }
        h2 { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
        td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .amt { text-align: right; }
        .total { font-weight: 700; border-top: 2px solid #2563eb; background: #f0f7ff; }
        .net { background: #2563eb; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; margin-top: 16px; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>          <div class="company-header">
        <svg width="44" height="44" viewBox="0 0 44 44" style="flex-shrink:0;"><rect width="44" height="44" rx="10" fill="#0B6E63"/><path d="M22 8l14 8v16l-14 8-14-8V16l14-8z" fill="rgba(255,255,255,0.15)"/><circle cx="22" cy="22" r="12" fill="#0D9488"/><path d="M22 14L28 18v8l-6 4-6-4v-8l6-4z" fill="white" opacity="0.9"/><circle cx="22" cy="22" r="3" fill="#0B6E63"/></svg>
        <div>
          <h1>Payslip</h1>
          <p style="margin:2px 0 0 0;color:#64748b;font-size:12px;">Demo Company Pvt Ltd</p>
        </div>
      </div>
      <p style="margin-top:0;color:#64748b;font-size:13px;">Period: <strong>${period}</strong></p>
      <p style="color:#64748b;font-size:13px;">Generated: ${genDate}</p>
      <h2>Earnings</h2>
      <table>
        <tr><th>Component</th><th class="amt">Amount</th></tr>
        <tr><td>Basic</td><td class="amt">${fmt(selected.basic)}</td></tr>
        <tr><td>Housing</td><td class="amt">${fmt(selected.housingAllowance)}</td></tr>
        <tr><td>Transport</td><td class="amt">${fmt(selected.transportAllowance)}</td></tr>
        <tr><td>Medical</td><td class="amt">${fmt(selected.medicalAllowance)}</td></tr>
        <tr><td>Other Allowances</td><td class="amt">${fmt(selected.otherAllowances)}</td></tr>
        ${selected.overtimePay > 0 ? `<tr><td>Overtime</td><td class="amt">${fmt(selected.overtimePay)}</td></tr>` : ''}
        ${selected.bonus > 0 ? `<tr><td>Bonus</td><td class="amt">${fmt(selected.bonus)}</td></tr>` : ''}
        <tr class="total"><td>Gross</td><td class="amt">${fmt(selected.grossPay)}</td></tr>
      </table>
      <h2>Deductions</h2>
      <table>
        <tr><th>Component</th><th class="amt">Amount</th></tr>
        <tr><td>Tax</td><td class="amt">${fmt(selected.taxDeduction)}</td></tr>
        <tr><td>Pension</td><td class="amt">${fmt(selected.pensionDeduction)}</td></tr>
        <tr><td>Insurance</td><td class="amt">${fmt(selected.insuranceDeduction)}</td></tr>
        ${selected.loanDeduction > 0 ? `<tr><td>Loan</td><td class="amt">${fmt(selected.loanDeduction)}</td></tr>` : ''}
        <tr class="total"><td>Total Deductions</td><td class="amt">${fmt(selected.totalDeductions)}</td></tr>
      </table>
      <div class="net"><span>Net Pay</span><span>${fmt(selected.netPay)}</span></div>
      <div class="footer">This is a computer-generated document &bull; ${genDate}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const openComparison = (p: Payslip) => {
    setSelected(p);
    setShowComparison(true);
  };

  // Find previous month's payslip for comparison
  const getPreviousPayslip = (p: Payslip): Payslip | undefined => {
    if (!p.run) return undefined;
    const prevMonth = p.run.month === 1 ? 12 : p.run.month - 1;
    const prevYear = p.run.month === 1 ? p.run.year - 1 : p.run.year;
    return prevByMonth.get(`${prevYear}-${prevMonth}`);
  };

  // Build yearly groups for the summary
  const yearlyGroups = groupByYear(data?.items ?? []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">My Payslips</h1>
          <p className="mt-1 text-sm text-ink-faint">
            View, compare, and download your monthly salary slips
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll || !data?.items?.length}
          >
            {downloadingAll ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Archive size={14} />
            )}
            Download All
          </Button>
        </div>
      </div>

      {/* Year Summary Cards */}
      {yearlyGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {yearlyGroups.slice(0, 4).map((group) => {
            const totalNet = group.payslips.reduce((sum, p) => sum + p.netPay, 0);
            const totalGross = group.payslips.reduce((sum, p) => sum + p.grossPay, 0);
            return (
              <Card key={group.year} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-ink-faint uppercase tracking-wide font-medium">{group.year} Summary</p>
                  <p className="text-lg font-semibold text-ink mt-1">{fmt(totalNet)}</p>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-ink-faint">
                    <span>{group.payslips.length} payslips</span>
                    <span>Gross: {fmt(totalGross)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payslip History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payslip History</CardTitle>
          {data && (
            <span className="text-xs text-ink-faint">{data.meta.total} total</span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-faint" />
            </div>
          )}
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
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelected(p)}>
                      <TableCell className="font-medium text-ink">
                        {p.run ? `${MONTHS_SHORT[p.run.month - 1]} ${p.run.year}` : '—'}
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
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openComparison(p)} title="Compare">
                            <TrendingUp size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(p)} disabled={downloadingId === p.id} title="Download PDF">
                            {downloadingId === p.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                          </Button>
                        </div>
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

      {/* Detail Dialog */}
      <Dialog open={!!selected && !showComparison} onOpenChange={o => { if (!o) { setSelected(null); setShowComparison(false); }}}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payslip Details</DialogTitle>
            <DialogDescription>
              {selected?.run ? `${MONTHS[selected.run.month - 1]} ${selected.run.year}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-blue-600 font-medium">Gross</p>
                  <p className="text-sm font-bold text-blue-700">{fmt(selected.grossPay)}</p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-red-600 font-medium">Deductions</p>
                  <p className="text-sm font-bold text-red-700">{fmt(selected.totalDeductions)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">Net Pay</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(selected.netPay)}</p>
                </div>
              </div>

              {/* Earnings */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 px-4 py-2 border-b border-border">
                  <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">Earnings</h4>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Basic</span><span className="text-sm font-medium">{fmt(selected.basic)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Housing Allowance</span><span className="text-sm font-medium">{fmt(selected.housingAllowance)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Transport Allowance</span><span className="text-sm font-medium">{fmt(selected.transportAllowance)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Medical Allowance</span><span className="text-sm font-medium">{fmt(selected.medicalAllowance)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Other Allowances</span><span className="text-sm font-medium">{fmt(selected.otherAllowances)}</span></div>
                  {selected.overtimePay > 0 && <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Overtime</span><span className="text-sm font-medium text-amber-600">{fmt(selected.overtimePay)}</span></div>}
                  {selected.bonus > 0 && <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Bonus</span><span className="text-sm font-medium text-amber-600">{fmt(selected.bonus)}</span></div>}
                  <div className="flex justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50/50 to-blue-100/30 font-bold text-blue-700">
                    <span className="text-sm">Gross Pay</span>
                    <span className="text-sm">{fmt(selected.grossPay)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-red-100/50 px-4 py-2 border-b border-border">
                  <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">Deductions</h4>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Tax Deduction</span><span className="text-sm font-medium">{fmt(selected.taxDeduction)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Pension Deduction</span><span className="text-sm font-medium">{fmt(selected.pensionDeduction)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Insurance Deduction</span><span className="text-sm font-medium">{fmt(selected.insuranceDeduction)}</span></div>
                  {selected.loanDeduction > 0 && <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Loan Deduction</span><span className="text-sm font-medium">{fmt(selected.loanDeduction)}</span></div>}
                  {selected.otherDeductions > 0 && <div className="flex justify-between px-4 py-2"><span className="text-sm text-ink-soft">Other Deductions</span><span className="text-sm font-medium">{fmt(selected.otherDeductions)}</span></div>}
                  <div className="flex justify-between px-4 py-2.5 bg-gradient-to-r from-red-50/50 to-red-100/30 font-bold text-red-700">
                    <span className="text-sm">Total Deductions</span>
                    <span className="text-sm">{fmt(selected.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="flex justify-between rounded-lg bg-gradient-to-r from-accent to-blue-700 p-4 text-white shadow-sm">
                <div>
                  <span className="text-xs uppercase tracking-wider opacity-80">Net Pay</span>
                  <p className="text-[10px] opacity-60 mt-0.5">Take-home salary after all deductions</p>
                </div>
                <span className="font-serif text-2xl font-bold">{fmt(selected.netPay)}</span>
              </div>

              {/* Status & Notes */}
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span>Status: <Badge variant={selected.status === 'PAID' ? 'success' : selected.status === 'APPROVED' ? 'default' : 'warning'} className="ml-1">{selected.status}</Badge></span>
                <span>Created: {new Date(selected.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!selected} title="Print">
                <Printer size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadSelected} disabled={downloadingId === selected?.id}>
                {downloadingId === selected?.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download PDF
              </Button>
            </div>
            <Button size="sm" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={!!selected && showComparison} onOpenChange={o => { if (!o) { setShowComparison(false); setSelected(null); }}}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Month-over-Month Comparison</DialogTitle>
            <DialogDescription>
              Comparing payslips side-by-side to track changes
            </DialogDescription>
          </DialogHeader>
          {selected && (() => {
            const previous = getPreviousPayslip(selected);
            const currPeriod = selected.run ? `${MONTHS[selected.run.month - 1]} ${selected.run.year}` : '';
            const prevPeriod = previous?.run ? `${MONTHS[previous.run.month - 1]} ${previous.run.year}` : '';
            return (
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                    <p className="text-[10px] uppercase text-blue-600 font-medium">{currPeriod}</p>
                    <p className="text-xs text-blue-800 font-bold">{fmt(selected.netPay)}</p>
                  </div>
                  {previous && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10px] uppercase text-slate-600 font-medium">{prevPeriod}</p>
                      <p className="text-xs text-slate-800 font-bold">{fmt(previous.netPay)}</p>
                    </div>
                  )}
                  <div className={`rounded-lg px-3 py-2 text-center ${previous ? (selected.netPay >= previous.netPay ? 'bg-emerald-50' : 'bg-red-50') : 'bg-slate-50'}`}>
                    <p className="text-[10px] uppercase font-medium">Change</p>
                    <p className={`text-xs font-bold ${previous ? (selected.netPay >= previous.netPay ? 'text-emerald-700' : 'text-red-700') : 'text-slate-600'}`}>
                      {previous ? fmt(selected.netPay - previous.netPay) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-border">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-faint uppercase tracking-wide">Component</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-faint uppercase tracking-wide">{currPeriod}</th>
                        {previous && (
                          <>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-faint uppercase tracking-wide">{prevPeriod}</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-faint uppercase tracking-wide">Change</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <PayComparison label="Basic" current={selected.basic} previous={previous?.basic} />
                      <PayComparison label="Housing Allowance" current={selected.housingAllowance} previous={previous?.housingAllowance} />
                      <PayComparison label="Transport Allowance" current={selected.transportAllowance} previous={previous?.transportAllowance} />
                      <PayComparison label="Medical Allowance" current={selected.medicalAllowance} previous={previous?.medicalAllowance} />
                      <PayComparison label="Other Allowances" current={selected.otherAllowances} previous={previous?.otherAllowances} />
                      <PayComparison label="Overtime Pay" current={selected.overtimePay} previous={previous?.overtimePay} />
                      <PayComparison label="Bonus" current={selected.bonus} previous={previous?.bonus} />
                      <tr className="bg-gradient-to-r from-blue-50/50 to-blue-100/30 font-bold">
                        <PayComparison label="Gross Pay" current={selected.grossPay} previous={previous?.grossPay} />
                      </tr>
                      <PayComparison label="Tax Deduction" current={selected.taxDeduction} previous={previous?.taxDeduction} />
                      <PayComparison label="Pension Deduction" current={selected.pensionDeduction} previous={previous?.pensionDeduction} />
                      <PayComparison label="Insurance Deduction" current={selected.insuranceDeduction} previous={previous?.insuranceDeduction} />
                      {selected.loanDeduction > 0 && <PayComparison label="Loan Deduction" current={selected.loanDeduction} previous={previous?.loanDeduction} />}
                      <tr className="bg-gradient-to-r from-red-50/50 to-red-100/30 font-bold">
                        <PayComparison label="Total Deductions" current={selected.totalDeductions} previous={previous?.totalDeductions} />
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Net Pay Comparison */}
                <div className="flex justify-between items-center rounded-lg bg-gradient-to-r from-accent to-blue-700 p-4 text-white shadow-sm">
                  <span className="text-sm uppercase tracking-wider opacity-80">Net Pay</span>
                  <div className="flex items-center gap-4">
                    {previous && (
                      <span className="text-xs opacity-70 line-through">{fmt(previous.netPay)}</span>
                    )}
                    <span className="font-serif text-2xl font-bold">{fmt(selected.netPay)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => { setShowComparison(false); }}>Back to Details</Button>
            <Button size="sm" onClick={() => { setShowComparison(false); setSelected(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
