'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, FileText, HandCoins, Landmark } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { PayrollDashboard } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayrollPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'dashboard'],
    queryFn: () => unwrap<PayrollDashboard>(api.get('/payroll/dashboard')),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Payroll</h1>
        <div className="flex gap-2">
          <Link href="/payroll/runs"><Button variant="outline" size="sm">Payroll Runs</Button></Link>
          <Link href="/payroll/loans"><Button variant="outline" size="sm">Loans</Button></Link>
          <Link href="/payroll/reimbursements"><Button variant="outline" size="sm">Reimbursements</Button></Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-ink-faint">Loading payroll dashboard…</p>}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Salary Structures</CardTitle>
                <FileText size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.activeStructures}</p>
                <p className="text-xs text-ink-faint">Active templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Active Salaries</CardTitle>
                <Users size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.activeSalaries}</p>
                <p className="text-xs text-ink-faint">Employees with salary assigned</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Pending Loans</CardTitle>
                <Landmark size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.pendingLoans}</p>
                <p className="text-xs text-ink-faint">{data.activeLoans} active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Pending Reimbursements</CardTitle>
                <HandCoins size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.pendingReimbursements}</p>
                <p className="text-xs text-ink-faint">Awaiting approval</p>
              </CardContent>
            </Card>
          </div>

          {/* Latest Payroll Run */}
          <Card>
            <CardHeader>
              <CardTitle>Latest Payroll Run</CardTitle>
            </CardHeader>
            <CardContent>
              {data.latestRun ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-4 text-sm sm:gap-6">
                    <div>
                      <p className="text-xs text-ink-faint">Period</p>
                      <p className="font-medium text-ink">{MONTHS[data.latestRun.month - 1]} {data.latestRun.year}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Employees</p>
                      <p className="font-medium text-ink">{data.latestRun.employeeCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Gross</p>
                      <p className="font-medium text-ink">{formatCurrency(data.latestRun.totalGross)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Deductions</p>
                      <p className="font-medium text-danger">{formatCurrency(data.latestRun.totalDeductions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Net Pay</p>
                      <p className="font-medium text-accent">{formatCurrency(data.latestRun.totalNet)}</p>
                    </div>
                  </div>
                  <Badge variant={data.latestRun.status === 'COMPLETED' ? 'success' : 'warning'}>
                    {data.latestRun.status}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-ink-faint">No payroll runs yet. Create one to get started.</p>
              )}
            </CardContent>
          </Card>

          {/* Yearly Overview */}
          {data.yearlyRuns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{data.currentYear} Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-responsive">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">Employees</th>
                      <th className="py-2 pr-4">Gross</th>
                      <th className="py-2 pr-4">Deductions</th>
                      <th className="py-2 pr-4">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.yearlyRuns.map((r) => (
                      <tr key={r.month} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4 font-medium text-ink">{MONTHS[r.month - 1]}</td>
                        <td className="py-3 pr-4 text-ink-soft">{r.employeeCount}</td>
                        <td className="py-3 pr-4 text-ink-soft">{formatCurrency(r.totalGross)}</td>
                        <td className="py-3 pr-4 text-danger">{formatCurrency(r.totalDeductions)}</td>
                        <td className="py-3 pr-4 text-accent">{formatCurrency(r.totalNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link href="/payroll/salary-structures">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <FileText size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Salary Structures</p>
                    <p className="text-xs text-ink-faint">Define pay templates</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/payroll/employee-salaries">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <Users size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Employee Salaries</p>
                    <p className="text-xs text-ink-faint">Assign salaries to employees</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/payroll/payslips">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <DollarSign size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Payslips</p>
                    <p className="text-xs text-ink-faint">View and approve payslips</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
