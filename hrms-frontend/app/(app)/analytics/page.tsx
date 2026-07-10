'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { Users, Building2, Briefcase, TrendingUp } from 'lucide-react';

// Dynamically import recharts components (heavy library ~60KB gzipped)
const AnalyticsCharts = dynamic(() => import('@/components/analytics-charts'), {
  ssr: false,
  loading: () => <div className="py-12 text-center text-sm text-ink-faint">Loading charts...</div>,
});

interface AnalyticsData {
  summary: { totalEmployees: number; activeEmployees: number; departmentsTotal: number; openPositions: number };
  attendanceToday: { present: number; absent: number; onLeave: number; halfDay: number; late: number };
  departmentStrength: { name: string; count: number }[];
  leaveTrend: { month: number; label: string; total: number; approved: number; pending: number; rejected: number; totalDays: number }[];
  salaryDistribution: {
    brackets: { label: string; count: number }[];
    byDepartment: { name: string; averageSalary: number; employeeCount: number }[];
    averageSalary: number;
    totalEmployees: number;
  };
  genderRatio: { male: number; female: number; other: number; undisclosed: number };
  newJoiners: { month: number; label: string; count: number }[];
  attrition: { month: number; label: string; resigned: number; terminated: number; total: number }[];
  currentYear: number;
}

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => unwrap<AnalyticsData>(api.get('/analytics/dashboard')),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Company Analytics</h1>

      {isLoading && <p className="text-sm text-ink-faint">Loading analytics...</p>}
      {isError && (
        <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&rsquo;t load analytics data. You may not have the required permissions.
        </p>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Users size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.totalEmployees}</p><p className="text-xs text-ink-faint">Total Employees</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><TrendingUp size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.activeEmployees}</p><p className="text-xs text-ink-faint">Active</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Building2 size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.departmentsTotal}</p><p className="text-xs text-ink-faint">Departments</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Briefcase size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.openPositions}</p><p className="text-xs text-ink-faint">Open Positions</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Charts - dynamically imported to reduce initial bundle size */}
          <AnalyticsCharts data={data} />
        </>
      )}
    </div>
  );
}
