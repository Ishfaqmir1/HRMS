'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import dynamic from 'next/dynamic';
import {
  Users, Building2, Briefcase, TrendingUp, Calendar,
  Download, BarChart3,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import type { AttendanceTrendPoint, DepartmentAttendanceSummary } from '@/lib/types';

// Dynamically import recharts components (heavy library ~60KB gzipped)
const AnalyticsCharts = dynamic(() => import('@/components/analytics-charts'), {
  ssr: false,
  loading: () => <div className="py-12 text-center text-sm text-ink-faint">Loading charts...</div>,
});

// Attendance charts are also heavy — separate dynamic chunk
const AttendanceCharts = dynamic(() => import('@/components/attendance-charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bento-card p-5"><div className="skeleton h-[260px] w-full" /></div>
      ))}
    </div>
  ),
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

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const now = new Date();
  const [trendFrom, setTrendFrom] = useState(() => formatDateInput(new Date(now.getFullYear(), 0, 1)));
  const [trendTo, setTrendTo] = useState(() => formatDateInput(now));
  const [granularity, setGranularity] = useState<'day' | 'month'>('month');
  const [deptFrom, setDeptFrom] = useState(() => formatDateInput(new Date(now.getFullYear(), 0, 1)));
  const [deptTo, setDeptTo] = useState(() => formatDateInput(now));
  const [isExporting, setIsExporting] = useState(false);

  // ===== Existing company analytics =====
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => unwrap<AnalyticsData>(api.get('/analytics/dashboard')),
  });

  // ===== Attendance trend report =====
  const {
    data: trendData,
    isLoading: trendLoading,
    isError: trendError,
  } = useQuery({
    queryKey: ['attendance', 'reports', 'trend', trendFrom, trendTo, granularity],
    queryFn: async () => {
      const result = await unwrap<{ period: any; granularity: string; data: AttendanceTrendPoint[] }>(
        api.get('/attendance/reports/trend', {
          params: { from: trendFrom, to: trendTo, granularity },
        }),
      );
      return result.data ?? [];
    },
    enabled: !!trendFrom && !!trendTo,
  });

  // ===== Department attendance summary =====
  const {
    data: deptData,
    isLoading: deptLoading,
    isError: deptError,
  } = useQuery({
    queryKey: ['attendance', 'reports', 'departments', deptFrom, deptTo],
    queryFn: async () => {
      const result = await unwrap<{ period: any; departments: DepartmentAttendanceSummary[] }>(
        api.get('/attendance/reports/departments', {
          params: { from: deptFrom, to: deptTo },
        }),
      );
      return result.departments ?? [];
    },
    enabled: !!deptFrom && !!deptTo,
  });

  // ===== CSV Export =====
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const accessToken = typeof window !== 'undefined' ? getAccessToken() : null;
      const params = new URLSearchParams({ from: trendFrom, to: trendTo });
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const url = `${baseUrl}/attendance/reports/export/csv?${params}`;

      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `attendance-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // silently fail — user can retry
    } finally {
      setIsExporting(false);
    }
  }, [trendFrom, trendTo]);

  // Quick date range presets
  const shiftMonth = (dir: -1 | 1) => {
    const d = new Date(trendFrom);
    d.setMonth(d.getMonth() + dir);
    setTrendFrom(formatDateInput(d));
    const d2 = new Date(trendTo);
    d2.setMonth(d2.getMonth() + dir);
    setTrendTo(formatDateInput(d2));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">
          Company Analytics
        </h1>
      </div>

      {/* ================================================================ */}
      {/* EXISTING ANALYTICS — Summary Cards + Charts                     */}
      {/* ================================================================ */}
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

          {/* Existing Charts */}
          <AnalyticsCharts data={data} />
        </>
      )}

      {/* ================================================================ */}
      {/* NEW — ATTENDANCE ANALYTICS SECTION                             */}
      {/* ================================================================ */}
      <div className="relative">
        {/* Section divider */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <BarChart3 size={18} />
          </div>
          <h2 className="font-serif text-xl font-semibold text-ink">Attendance Analytics</h2>
        </div>

        <AttendanceCharts
          trendData={trendData ?? []}
          trendLoading={trendLoading}
          trendError={trendError}
          deptData={deptData ?? []}
          deptLoading={deptLoading}
          deptError={deptError}
          trendFrom={trendFrom}
          trendTo={trendTo}
          onTrendFromChange={setTrendFrom}
          onTrendToChange={setTrendTo}
          granularity={granularity}
          onGranularityChange={setGranularity}
          deptFrom={deptFrom}
          deptTo={deptTo}
          onDeptFromChange={setDeptFrom}
          onDeptToChange={setDeptTo}
          isExporting={isExporting}
          onExport={handleExport}
          shiftMonth={shiftMonth}
        />
      </div>
    </div>
  );
}
