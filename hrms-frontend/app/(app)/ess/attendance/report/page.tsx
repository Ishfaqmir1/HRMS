'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Clock, UserCheck, AlertTriangle,
  Sun, Timer, Coffee, CalendarDays,
  TrendingUp, TrendingDown, Minus, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface CalendarDayRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  breakMinutes: number | null;
  overtimeMinutes: number | null;
  lateMinutes: number | null;
  status: string;
  source: string;
  isHoliday: boolean;
}

interface Holiday {
  date: string;
  name: string;
}

interface CalendarData {
  year: number;
  month: number;
  records: CalendarDayRecord[];
  holidays: Holiday[];
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ──────────────────────────────────────────────────────────
// Components
// ──────────────────────────────────────────────────────────

function MiniStatCard({ label, value, icon: Icon, color, trend }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bento-card p-4 card-hover">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.replace('text-', 'bg-')}/10`}>
          <Icon size={18} className={color} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            trend === 'up' ? 'bg-accent-soft text-accent' :
            trend === 'down' ? 'bg-danger-soft text-danger' :
            'bg-ink-soft/5 text-ink-faint'
          }`}>
            {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
          </div>
        )}
      </div>
      <p className="mt-3 font-serif text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-faint">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN REPORT PAGE
// ═══════════════════════════════════════════════════════════

export default function AttendanceReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'attendance-calendar', year, month],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year, month } })),
  });

  // Load previous month for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { data: prevData } = useQuery({
    queryKey: ['me', 'attendance-calendar', prevYear, prevMonth],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year: prevYear, month: prevMonth } })),
  });

  const goPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const goNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // ── Compute stats from calendar data ──

  const stats = useMemo(() => {
    if (!data?.records) return null;

    const records = data.records;
    const totalDays = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const halfDay = records.filter(r => r.status === 'HALF_DAY').length;
    const onLeave = records.filter(r => r.status === 'ON_LEAVE').length;
    const holidaysCount = data.holidays.filter(h => {
      const d = new Date(h.date);
      const day = d.getDay();
      return day !== 0 && day !== 6; // Exclude weekends from holiday count
    }).length;

    const totalWorked = records.reduce((s, r) => s + (r.workedMinutes || 0), 0);
    const totalBreak = records.reduce((s, r) => s + (r.breakMinutes || 0), 0);
    const totalOvertime = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
    const daysWithWork = records.filter(r => r.workedMinutes != null).length;
    const avgWorked = daysWithWork > 0 ? Math.round(totalWorked / daysWithWork) : 0;

    const workedDays = present + late + halfDay;
    const attendanceRate = totalDays > 0 ? Math.round((workedDays / totalDays) * 100) : 0;

    // Average check-in time
    const checkInTimes = records.filter(r => r.checkIn).map(r => new Date(r.checkIn!).getTime());
    const avgCheckIn = checkInTimes.length > 0
      ? new Date(checkInTimes.reduce((s, t) => s + t, 0) / checkInTimes.length)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

    // This month's days
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekendsInMonth = (() => {
      let count = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month - 1, d).getDay();
        if (day === 0 || day === 6) count++;
      }
      return count;
    })();

    return {
      totalDays,
      present,
      absent,
      late,
      halfDay,
      onLeave,
      holidaysCount,
      attendanceRate,
      totalWorked: formatDuration(totalWorked),
      totalBreak: formatDuration(totalBreak),
      totalOvertime: formatDuration(totalOvertime),
      avgWorked: formatDuration(avgWorked),
      avgCheckIn,
      workedDays,
      daysInMonth,
      weekendsInMonth,
    };
  }, [data, year, month]);

  // ── Compare with previous month ──

  const comparison = useMemo(() => {
    if (!stats || !prevData?.records) return null;
    const prevRecords = prevData.records;
    const prevPresent = prevRecords.filter(r => r.status === 'PRESENT').length;
    const prevTotal = prevRecords.length;
    const prevRate = prevTotal > 0 ? Math.round(((prevPresent + prevRecords.filter(r => r.status === 'LATE').length + prevRecords.filter(r => r.status === 'HALF_DAY').length) / prevTotal) * 100) : 0;

    return {
      rateDiff: stats.attendanceRate - prevRate,
      presentDiff: stats.present - prevPresent,
    };
  }, [stats, prevData]);

  // ── Daily breakdown table ──

  const dailyRows = useMemo(() => {
    if (!data?.records) return [];
    return [...data.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const STYLE_MAP: Record<string, { bg: string; text: string; dot: string }> = {
    PRESENT: { bg: 'bg-accent-soft', text: 'text-accent', dot: 'bg-accent' },
    ABSENT: { bg: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger' },
    LATE: { bg: 'bg-amber-soft', text: 'text-amber', dot: 'bg-amber' },
    HALF_DAY: { bg: 'bg-amber-soft', text: 'text-amber', dot: 'bg-amber' },
    ON_LEAVE: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-600' },
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ess/attendance"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-faint hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Report</h1>
            <p className="text-sm text-ink-faint">Your monthly attendance overview</p>
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
        <Button variant="ghost" size="sm" onClick={goPrev}>
          <ChevronLeft size={16} />
        </Button>
        <div className="text-center">
          <p className="font-serif text-xl font-semibold text-ink">{MONTHS[month - 1]} {year}</p>
          {stats && (
            <p className="text-xs text-ink-faint">
              {stats.daysInMonth} days · {stats.weekendsInMonth} weekends · {stats.holidaysCount} holidays
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={goNext} disabled={month === now.getMonth() + 1 && year === now.getFullYear()}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* ── Key Metrics ── */}
          <div className="stagger-enter grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStatCard
              label="Attendance Rate"
              value={`${stats.attendanceRate}%`}
              icon={UserCheck}
              color={stats.attendanceRate >= 80 ? 'text-accent' : stats.attendanceRate >= 60 ? 'text-amber' : 'text-danger'}
              trend={comparison ? (comparison.rateDiff > 0 ? 'up' : comparison.rateDiff < 0 ? 'down' : 'neutral') : undefined}
            />
            <MiniStatCard
              label="Days Present"
              value={stats.present.toString()}
              icon={UserCheck}
              color="text-accent"
            />
            <MiniStatCard
              label="Absent"
              value={stats.absent.toString()}
              icon={AlertTriangle}
              color={stats.absent > 0 ? 'text-danger' : 'text-ink-soft'}
            />
            <MiniStatCard
              label="Late Arrivals"
              value={stats.late.toString()}
              icon={Clock}
              color={stats.late > 0 ? 'text-amber' : 'text-ink-soft'}
            />
            <MiniStatCard
              label="Half Days"
              value={stats.halfDay.toString()}
              icon={Sun}
              color={stats.halfDay > 0 ? 'text-amber' : 'text-ink-soft'}
            />
            <MiniStatCard
              label="On Leave"
              value={stats.onLeave.toString()}
              icon={CalendarDays}
              color={stats.onLeave > 0 ? 'text-blue-600' : 'text-ink-soft'}
            />
            <MiniStatCard
              label="Avg Worked / Day"
              value={stats.avgWorked}
              icon={Timer}
              color="text-ink"
            />
            <MiniStatCard
              label="Avg Clock In"
              value={stats.avgCheckIn}
              icon={Clock}
              color="text-ink"
            />
          </div>

          {/* ── Worked Hours Breakdown ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Time Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-accent-soft p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Total Worked</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-accent">{stats.totalWorked}</p>
                  <p className="mt-1 text-[10px] text-ink-faint">Across {stats.workedDays} days</p>
                </div>
                <div className="rounded-xl bg-amber-soft p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Break Time</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-amber">{stats.totalBreak}</p>
                  <p className="mt-1 text-[10px] text-ink-faint"><Coffee size={10} className="mr-0.5 inline" /> Total breaks</p>
                </div>
                <div className="rounded-xl bg-accent-soft/60 p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Overtime</p>
                  <p className="mt-1 font-serif text-3xl font-semibold text-accent">{stats.totalOvertime}</p>
                  <p className="mt-1 text-[10px] text-ink-faint">Extra hours this month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Status Distribution Bar ── */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-8 overflow-hidden rounded-lg">
                {stats.present > 0 && (
                  <div
                    className="flex items-center justify-center bg-accent text-[10px] font-medium text-white transition-all"
                    style={{ width: `${(stats.present / stats.totalDays) * 100}%` }}
                  >
                    {stats.present > 2 && `${stats.present}`}
                  </div>
                )}
                {stats.late > 0 && (
                  <div
                    className="flex items-center justify-center bg-amber text-[10px] font-medium text-white"
                    style={{ width: `${(stats.late / stats.totalDays) * 100}%` }}
                  >
                    {stats.late > 2 && `${stats.late}`}
                  </div>
                )}
                {stats.halfDay > 0 && (
                  <div
                    className="flex items-center justify-center bg-purple-500 text-[10px] font-medium text-white"
                    style={{ width: `${(stats.halfDay / stats.totalDays) * 100}%` }}
                  >
                    {stats.halfDay > 2 && `${stats.halfDay}`}
                  </div>
                )}
                {stats.onLeave > 0 && (
                  <div
                    className="flex items-center justify-center bg-blue-500 text-[10px] font-medium text-white"
                    style={{ width: `${(stats.onLeave / stats.totalDays) * 100}%` }}
                  >
                    {stats.onLeave > 2 && `${stats.onLeave}`}
                  </div>
                )}
                {stats.absent > 0 && (
                  <div
                    className="flex items-center justify-center bg-danger text-[10px] font-medium text-white"
                    style={{ width: `${(stats.absent / stats.totalDays) * 100}%` }}
                  >
                    {stats.absent > 2 && `${stats.absent}`}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Present ({stats.present})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber" /> Late ({stats.late})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-500" /> Half Day ({stats.halfDay})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Leave ({stats.onLeave})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-danger" /> Absent ({stats.absent})
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Daily Breakdown Table ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Daily Breakdown</CardTitle>
                <span className="text-xs text-ink-faint">{dailyRows.length} days</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {dailyRows.map((record) => {
                  const style = STYLE_MAP[record.status] || { bg: 'bg-ink-soft/5', text: 'text-ink-faint', dot: 'bg-ink-faint' };
                  return (
                    <div key={record.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-soft/5">
                      <div className={`flex h-2 w-2 rounded-full ${style.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{formatDate(record.date)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-soft">
                        <span>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        <span className="text-ink-faint">→</span>
                        <span>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      </div>
                      <div className="w-16 text-right text-xs font-medium tabular-nums text-ink">
                        {formatDuration(record.workedMinutes)}
                      </div>
                      <Badge tone={statusTone(record.status)} className="text-[10px] w-[68px] justify-center">
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
                {dailyRows.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-ink-faint">
                    No attendance records for this month.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays size={32} className="mx-auto mb-3 text-ink-faint" />
            <p className="text-sm text-ink-faint">No attendance data available for this month.</p>
          </CardContent>
        </Card>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-center gap-3 pb-8">
        <Link
          href="/ess/attendance"
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-ink-soft hover:bg-accent-soft hover:text-accent transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Attendance
        </Link>
      </div>
    </div>
  );
}
