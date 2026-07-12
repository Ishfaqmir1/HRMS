'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Calendar, ChevronLeft, ChevronRight, Download, Users,
  Clock, AlertTriangle, Moon, Coffee,
} from 'lucide-react';
import type { AttendanceTrendPoint, DepartmentAttendanceSummary } from '@/lib/types';

// ===== Color Palette =====
const COLORS = {
  accent: '#0B6E63',
  accentLight: '#4DB6A8',
  danger: '#B42318',
  amber: '#B45309',
  inkSoft: '#3C4A5E',
  inkFaint: '#7C8A9E',
  teal: '#14A898',
  purple: '#7C3AED',
  pink: '#DB2777',
  blue: '#2563EB',
  green: '#16A34A',
  present: '#0B6E63',
  absent: '#B42318',
  late: '#B45309',
  halfDay: '#7C3AED',
  onLeave: '#2563EB',
};

const CHART_TICK = { fontSize: 11, fill: COLORS.inkSoft };
const CHART_TICK_Faint = { fontSize: 11, fill: COLORS.inkFaint };
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #E1E5EA',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  fontSize: 12,
};

// ===== Helper: Format minutes to hours:minutes =====
function fmtMinutes(m: number): string {
  if (!m || m <= 0) return '—';
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${h}h ${mins}m`;
}

// ===== Helper: Format percentage =====
function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// =====================================================
// Props
// =====================================================
interface AttendanceChartsProps {
  trendData: AttendanceTrendPoint[];
  trendLoading: boolean;
  trendError: boolean;
  deptData: DepartmentAttendanceSummary[];
  deptLoading: boolean;
  deptError: boolean;
  trendFrom: string;
  trendTo: string;
  onTrendFromChange: (v: string) => void;
  onTrendToChange: (v: string) => void;
  granularity: 'day' | 'month';
  onGranularityChange: (v: 'day' | 'month') => void;
  deptFrom: string;
  deptTo: string;
  onDeptFromChange: (v: string) => void;
  onDeptToChange: (v: string) => void;
  isExporting: boolean;
  onExport: () => void;
  shiftMonth: (dir: -1 | 1) => void;
}

export default function AttendanceCharts({
  trendData, trendLoading, trendError,
  deptData, deptLoading, deptError,
  trendFrom, trendTo, onTrendFromChange, onTrendToChange,
  granularity, onGranularityChange,
  deptFrom, deptTo, onDeptFromChange, onDeptToChange,
  isExporting, onExport, shiftMonth,
}: AttendanceChartsProps) {
  // Defensive: ensure data is array before accessing .length or calling .reduce()
  const trendDataArr = Array.isArray(trendData) ? trendData : [];
  const deptDataArr = Array.isArray(deptData) ? deptData : [];
  const hasTrendData = trendDataArr.length > 0;
  const hasDeptData = deptDataArr.length > 0;

  // Compute aggregates for summary cards
  const totalPresent = trendDataArr.reduce((s, d) => s + d.present, 0);
  const totalAbsent = trendDataArr.reduce((s, d) => s + d.absent, 0);
  const totalLate = trendDataArr.reduce((s, d) => s + d.late, 0);
  const totalOvertime = trendDataArr.reduce((s, d) => s + d.totalOvertimeMinutes, 0);
  const grandTotal = totalPresent + totalAbsent + totalLate +
    trendDataArr.reduce((s, d) => s + d.halfDay, 0) +
    trendDataArr.reduce((s, d) => s + d.onLeave, 0);
  const attendanceRate = grandTotal > 0 ? totalPresent / grandTotal : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ================================================================ */}
      {/* 1. ATTENDANCE TREND REPORT — Full width                        */}
      {/* ================================================================ */}
      <div className="bento-card p-5 lg:col-span-2">
        {/* Controls Row */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="stat-label">Attendance Trend</p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Granularity toggle */}
            <Select
              value={granularity}
              onValueChange={(v) => onGranularityChange(v as 'day' | 'month')}
            >
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-paper hover:text-ink"
                aria-label="Previous period"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1">
                <Calendar size={13} className="text-ink-faint" />
                <input
                  type="date"
                  value={trendFrom}
                  onChange={(e) => onTrendFromChange(e.target.value)}
                  className="w-[108px] border-none bg-transparent text-xs text-ink outline-none"
                />
                <span className="text-ink-faint">–</span>
                <input
                  type="date"
                  value={trendTo}
                  onChange={(e) => onTrendToChange(e.target.value)}
                  className="w-[108px] border-none bg-transparent text-xs text-ink outline-none"
                />
              </div>
              <button
                onClick={() => shiftMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-paper hover:text-ink"
                aria-label="Next period"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              isLoading={isExporting}
              className="h-8 gap-1.5 text-xs"
            >
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Trend Chart */}
        {trendLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="skeleton h-[260px] w-full max-w-3xl rounded-lg" />
          </div>
        )}
        {trendError && (
          <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            Couldn&rsquo;t load attendance trends.
          </p>
        )}
        {!trendLoading && !trendError && !hasTrendData && (
          <p className="py-12 text-center text-sm text-ink-faint">
            No attendance data for the selected period.
          </p>
        )}
        {!trendLoading && !trendError && hasTrendData && (
          <>
            {/* Mini KPI summary row */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-accent/[0.06] px-3 py-2.5">
                <p className="text-xs text-ink-faint">Attendance Rate</p>
                <p className="font-serif text-lg font-semibold text-ink">{fmtPct(attendanceRate)}</p>
              </div>
              <div className="rounded-lg bg-accent/[0.06] px-3 py-2.5">
                <p className="text-xs text-ink-faint">Total Present</p>
                <p className="font-serif text-lg font-semibold text-ink">{totalPresent.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-amber/[0.06] px-3 py-2.5">
                <p className="text-xs text-ink-faint">Late Arrivals</p>
                <p className="font-serif text-lg font-semibold text-ink">{totalLate.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-accent/[0.06] px-3 py-2.5">
                <p className="text-xs text-ink-faint">Overtime (total)</p>
                <p className="font-serif text-lg font-semibold text-ink">{fmtMinutes(totalOvertime)}</p>
              </div>
            </div>

            {/* Stacked bar chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendDataArr} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
                <XAxis
                  dataKey="date_label"
                  tick={CHART_TICK}
                  tickFormatter={(v: string) => {
                    // For monthly, shorten to "Jan", "Feb" etc
                    if (granularity === 'month' && v.length > 3) {
                      return v.slice(0, 3);
                    }
                    return v;
                  }}
                />
                <YAxis tick={CHART_TICK_Faint} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = {
                      present: 'Present', absent: 'Absent',
                      late: 'Late', halfDay: 'Half Day', onLeave: 'On Leave',
                      avgWorkedMinutes: 'Avg Worked', totalOvertimeMinutes: 'Overtime',
                    };
                    const num = typeof value === 'number' ? value : 0;
                    const label = typeof name === 'string' ? (labels[name] || name) : String(name ?? '');
                    return [num.toLocaleString(), label];
                  }}
                  labelFormatter={(label: any, payload: any) => {
                    const p = payload?.[0]?.payload;
                    if (p?.avgWorkedMinutes != null) {
                      return `${label} · ⏱ avg ${fmtMinutes(p.avgWorkedMinutes)}`;
                    }
                    return label;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      present: 'Present', absent: 'Absent',
                      late: 'Late', halfDay: 'Half Day', onLeave: 'On Leave',
                    };
                    return labels[value] || value;
                  }}
                />
                <Bar dataKey="present" stackId="a" fill={COLORS.present} radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" stackId="a" fill={COLORS.absent} />
                <Bar dataKey="late" stackId="a" fill={COLORS.late} />
                <Bar dataKey="halfDay" stackId="a" fill={COLORS.halfDay} />
                <Bar dataKey="onLeave" stackId="a" fill={COLORS.onLeave} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Overtime sparkline */}
            {trendDataArr.some((d) => d.totalOvertimeMinutes > 0) && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Overtime Trend (minutes)
                </p>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={trendDataArr} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}20`} />
                    <XAxis
                      dataKey="date_label"
                      tick={false}
                      axisLine={false}
                    />
                    <YAxis tick={CHART_TICK_Faint} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any) => {
                        const num = typeof value === 'number' ? value : 0;
                        return [fmtMinutes(num), 'Overtime'];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalOvertimeMinutes"
                      stroke={COLORS.accent}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS.accent }}
                      name="Overtime"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* 2. DEPARTMENT ATTENDANCE SUMMARY — Full width                  */}
      {/* ================================================================ */}
      <div className="bento-card p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="stat-label">Attendance by Department</p>
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-ink-faint" />
            <input
              type="date"
              value={deptFrom}
              onChange={(e) => onDeptFromChange(e.target.value)}
              className="h-8 w-[120px] rounded-lg border border-border bg-white px-2 text-xs text-ink outline-none"
            />
            <span className="text-xs text-ink-faint">to</span>
            <input
              type="date"
              value={deptTo}
              onChange={(e) => onDeptToChange(e.target.value)}
              className="h-8 w-[120px] rounded-lg border border-border bg-white px-2 text-xs text-ink outline-none"
            />
          </div>
        </div>

        {deptLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="skeleton h-[300px] w-full max-w-3xl rounded-lg" />
          </div>
        )}
        {deptError && (
          <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            Couldn&rsquo;t load department attendance data.
          </p>
        )}
        {!deptLoading && !deptError && !hasDeptData && (
          <p className="py-12 text-center text-sm text-ink-faint">
            No attendance data for the selected period.
          </p>
        )}
        {!deptLoading && !deptError && hasDeptData && (
          <ResponsiveContainer width="100%" height={Math.max(220, deptDataArr.length * 52)}>
            <BarChart
              data={deptDataArr}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}25`} horizontal={false} />
              <XAxis
                type="number"
                tick={CHART_TICK_Faint}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <YAxis
                type="category"
                dataKey="departmentName"
                tick={CHART_TICK}
                width={90}
                tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 13)}…` : v}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: any, name: any) => {
                  const labels: Record<string, string> = {
                    present: 'Present', absent: 'Absent',
                    late: 'Late', halfDay: 'Half Day', onLeave: 'On Leave',
                  };
                  const num = typeof value === 'number' ? value : 0;
                  const label = typeof name === 'string' ? (labels[name] || name) : String(name ?? '');
                  return [num.toLocaleString(), label];
                }}
                labelFormatter={(label: any, payload: any) => {
                  const p = payload?.[0]?.payload;
                  if (p) {
                    return `${p.departmentName} · ${p.employeeCount} employees · Rate: ${fmtPct(p.attendanceRate)}`;
                  }
                  return label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    present: 'Present', absent: 'Absent',
                    late: 'Late', halfDay: 'Half Day', onLeave: 'On Leave',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar dataKey="present" stackId="a" fill={COLORS.present} />
              <Bar dataKey="absent" stackId="a" fill={COLORS.absent} />
              <Bar dataKey="late" stackId="a" fill={COLORS.late} />
              <Bar dataKey="halfDay" stackId="a" fill={COLORS.halfDay} />
              <Bar dataKey="onLeave" stackId="a" fill={COLORS.onLeave} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ================================================================ */}
      {/* 3. DEPARTMENT SUMMARY TABLE — Half width                       */}
      {/* ================================================================ */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Department Attendance Rate</p>
        {!hasDeptData ? (
          <p className="py-6 text-center text-sm text-ink-faint">No data.</p>
        ) : (
          <div className="space-y-2">
            {[...deptDataArr]
              .sort((a, b) => b.attendanceRate - a.attendanceRate)
              .slice(0, 8)
              .map((dept) => {
                const pct = dept.attendanceRate * 100;
                const tone = pct >= 90 ? COLORS.present : pct >= 75 ? COLORS.amber : COLORS.absent;
                return (
                  <div key={dept.departmentId ?? 'unassigned'} className="flex items-center gap-3">
                    <span className="w-24 truncate text-sm text-ink-soft" title={dept.departmentName}>
                      {dept.departmentName === 'Unassigned' ? 'Unassigned' : dept.departmentName}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: tone,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-12 text-right text-xs font-medium tabular-nums text-ink">
                      {fmtPct(dept.attendanceRate)}
                    </span>
                  </div>
                );
              })}
            {deptDataArr.length > 8 && (
              <p className="pt-1 text-center text-xs text-ink-faint">
                +{deptDataArr.length - 8} more departments
              </p>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 4. STATUS BREAKDOWN — Half width                               */}
      {/* ================================================================ */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Status Breakdown</p>
        {!hasTrendData ? (
          <p className="py-6 text-center text-sm text-ink-faint">No data.</p>
        ) : (
          <div className="space-y-3">
            {([
              { label: 'Present', value: totalPresent, color: COLORS.present, icon: Users },
              { label: 'Absent', value: totalAbsent, color: COLORS.absent, icon: AlertTriangle },
              { label: 'Late', value: totalLate, color: COLORS.late, icon: Clock },
              { label: 'Half Day',              value: trendDataArr.reduce((s, d) => s + d.halfDay, 0), color: COLORS.halfDay, icon: Coffee },
              { label: 'On Leave', value: trendDataArr.reduce((s, d) => s + d.onLeave, 0), color: COLORS.onLeave, icon: Moon },
            ] as const).map(({ label, value, color, icon: Icon }) => {
              const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
              return (
                <div key={label} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-paper/60">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}12` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      <span className="text-sm font-semibold text-ink">{value.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-ink-faint">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
