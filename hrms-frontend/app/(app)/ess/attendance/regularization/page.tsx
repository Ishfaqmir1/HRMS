'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import type { AttendanceRegularization, PaginatedResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle,
  History, Send, ArrowLeft, UserCheck, AlertTriangle, Sun,
  X, Square, CheckSquare, FileText, Loader2,
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
  status: string;
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
// Constants
// ──────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// greythr-style: each status gets a distinct color
const CALENDAR_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Present' },
  ABSENT:    { bg: 'bg-red-100', text: 'text-red-800', label: 'Absent' },
  LATE:      { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Late' },
  HALF_DAY:  { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Half Day' },
  ON_LEAVE:  { bg: 'bg-blue-100', text: 'text-blue-800', label: 'On Leave' },
  HOLIDAY:   { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Holiday' },
  WEEK_OFF:  { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Week Off' },
};

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  PRESENT: UserCheck,
  ABSENT: AlertTriangle,
  HALF_DAY: Clock,
  LATE: AlertTriangle,
  ON_LEAVE: Sun,
  HOLIDAY: Sun,
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getDayStatus(day: number, recordMap: Map<string, CalendarDayRecord>, holidayMap: Map<string, string>): string | null {
  if (holidayMap.has(day.toString())) return 'HOLIDAY';
  const rec = recordMap.get(day.toString());
  if (!rec) return null;
  return rec.status;
}

// ═══════════════════════════════════════════════════════════
// REGULARIZATION DRAWER — slides in when a day is clicked
// ═══════════════════════════════════════════════════════════

function RegularizationDrawer({
  selectedDays,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  selectedDays: { day: number; record: CalendarDayRecord | null }[];
  onClose: () => void;
  onSubmit: (data: { reason: string; requestedCheckIn?: string; requestedCheckOut?: string; requestedStatus?: string; notes?: string }) => void;
  isPending: boolean;
  error: string;
}) {
  const [reason, setReason] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [requestedStatus, setRequestedStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const datesLabel = selectedDays.length === 1
    ? formatDate(selectedDays[0].record?.date || `${selectedDays[0].day}`)
    : `${selectedDays.length} days selected`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!reason.trim()) {
      setFormError('Please provide a reason for regularization.');
      return;
    }
    onSubmit({ reason, requestedCheckIn: requestedCheckIn || undefined, requestedCheckOut: requestedCheckOut || undefined, requestedStatus: requestedStatus || undefined, notes: notes || undefined });
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm drawer-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md animate-slide-right border-l border-border bg-white shadow-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">Regularization Request</p>
              <p className="text-xs text-ink-faint">{datesLabel}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-ink-soft/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Selected Days Preview */}
          <div className="border-b border-border px-5 py-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-faint">Selected Days</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedDays.map(({ day, record }) => {
                const status = record?.status || 'NO_RECORD';
                const color = CALENDAR_COLORS[status];
                return (
                  <div key={day} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${color?.bg || 'bg-gray-100'} ${color?.text || 'text-gray-600'}`}>
                    <span>{day}</span>
                    <span className="opacity-60">{status === 'HOLIDAY' ? '🎉' : status?.replace('_', ' ') || '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">Reason for Regularization *</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent min-h-[80px] resize-none"
                  placeholder="Why do you need to regularize this day? E.g. 'Forgot to clock in due to network issues'"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">Actual Check-In</label>
                  <Input
                    type="time"
                    value={requestedCheckIn}
                    onChange={(e) => setRequestedCheckIn(e.target.value)}
                    placeholder="09:00"
                  />
                  <p className="mt-0.5 text-[9px] text-ink-faint">What time you actually arrived</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink">Actual Check-Out</label>
                  <Input
                    type="time"
                    value={requestedCheckOut}
                    onChange={(e) => setRequestedCheckOut(e.target.value)}
                    placeholder="18:00"
                  />
                  <p className="mt-0.5 text-[9px] text-ink-faint">What time you actually left</p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">Requested Status</label>
                <Select value={requestedStatus} onValueChange={(val) => setRequestedStatus(val)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Keep original status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keep original status</SelectItem>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="LATE">Late Arrival</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink">Additional Notes</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent min-h-[60px] resize-none"
                  placeholder="Any supporting details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {(formError || error) && (
                <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {formError || error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={isPending}
              >
                <Send size={14} className="mr-1.5" />
                Submit Regularization Request
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT — Greythr-style Regularization
// ═══════════════════════════════════════════════════════════

export default function AttendanceRegularizationPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [historyPage, setHistoryPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<{ day: number; record: CalendarDayRecord | null }[]>([]);

  // Bulk selection mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<Set<number>>(new Set());

  // Submit loading state (for single + bulk)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form error
  const [formError, setFormError] = useState('');

  // ── Queries ──

  // Calendar data for this month (attendance records)
  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['me', 'attendance-calendar', year, month],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year, month } })),
  });

  // Regularization history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['me', 'attendance-regularizations', historyPage],
    queryFn: () => unwrap<PaginatedResult<AttendanceRegularization>>(
      api.get('/me/attendance/regularizations', { params: { page: historyPage, limit: 20 } }),
    ),
  });

  // ── Calendar helpers ──

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const recordMap = useMemo(() => {
    const map = new Map<string, CalendarDayRecord>();
    if (!calendarData?.records) return map;
    calendarData.records.forEach(r => {
      map.set(new Date(r.date).getDate().toString(), r);
    });
    return map;
  }, [calendarData]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!calendarData?.holidays) return map;
    calendarData.holidays.forEach(h => {
      map.set(new Date(h.date).getDate().toString(), h.name);
    });
    return map;
  }, [calendarData]);

  const cells = useMemo(() => {
    const result: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    return result;
  }, [firstDay, daysInMonth]);

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setBulkSelection(new Set());
    setBulkMode(false);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setBulkSelection(new Set());
    setBulkMode(false);
  }, [month]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedDays([]);
    setBulkMode(false);
    setBulkSelection(new Set());
    setFormError('');
  };

  // Click a single day → open regularization drawer
  const handleDayClick = (day: number) => {
    if (bulkMode) {
      toggleBulkSelection(day);
      return;
    }
    const record = recordMap.get(day.toString()) ?? null;
    setSelectedDays([{ day, record }]);
    setDrawerOpen(true);
  };

  // Toggle bulk selection
  const toggleBulkSelection = (day: number) => {
    setBulkSelection(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  // Submit bulk regularization
  const handleBulkSubmit = () => {
    const days = Array.from(bulkSelection).map(day => ({
      day,
      record: recordMap.get(day.toString()) ?? null,
    }));
    if (days.length === 0) return;
    setSelectedDays(days);
    setDrawerOpen(true);
  };

  // Submit the regularization request(s)
  const handleSubmit = (data: { reason: string; requestedCheckIn?: string; requestedCheckOut?: string; requestedStatus?: string; notes?: string }) => {
    setIsSubmitting(true);
    setFormError('');

    const promises = selectedDays.map(({ day }) => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const body: any = {
        date: dateStr,
        reason: data.reason,
        notes: data.notes,
      };
      if (data.requestedStatus) body.requestedStatus = data.requestedStatus;
      if (data.requestedCheckIn) {
        body.requestedCheckIn = `${dateStr}T${data.requestedCheckIn}:00.000Z`;
      }
      if (data.requestedCheckOut) {
        body.requestedCheckOut = `${dateStr}T${data.requestedCheckOut}:00.000Z`;
      }
      return api.post('/me/attendance/regularizations', body);
    });

    Promise.all(promises)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['me', 'attendance-regularizations'] });
        queryClient.invalidateQueries({ queryKey: ['me', 'attendance-calendar'] });
        closeDrawer();
      })
      .catch((err: any) => {
        setFormError(err?.response?.data?.message || err?.message || 'Some requests failed.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const isTodayInView = month === now.getMonth() + 1 && year === now.getFullYear();

  // Stats for the month
  const monthStats = useMemo(() => {
    if (!calendarData?.records) return null;
    const counts: Record<string, number> = {};
    for (const st of ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE']) {
      counts[st] = calendarData.records.filter(r => r.status === st).length;
    }
    return counts;
  }, [calendarData]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ess/attendance"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-faint hover:bg-accent-soft hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">Regularization</h1>
            <p className="text-sm text-ink-faint">Correct past attendance records</p>
          </div>
        </div>
      </div>

      {/* ─── GREYTHR-STYLE CALENDAR ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{MONTHS[month - 1]} {year}</CardTitle>
              {isTodayInView && (
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-accent/40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk mode toggle */}
              <Button
                variant={bulkMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setBulkMode(!bulkMode); setBulkSelection(new Set()); }}
                className="h-8 text-xs"
              >
                {bulkMode ? (
                  <><CheckSquare size={12} className="mr-1" /> Bulk</>
                ) : (
                  <><Square size={12} className="mr-1" /> Bulk</>
                )}
              </Button>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft size={14} /></Button>
                <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight size={14} /></Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {calendarLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-ink-faint">{d}</div>
              ))}
              {[...Array(35)].map((_, i) => (
                <div key={i} className="skeleton min-h-[48px] rounded-md sm:min-h-[64px]" />
              ))}
            </div>
          ) : calendarData ? (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-faint sm:text-xs">
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;

                  const status = getDayStatus(day, recordMap, holidayMap);
                  const holidayName = holidayMap.get(day.toString()) ?? null;
                  const rec = recordMap.get(day.toString()) ?? null;
                  const color = status ? CALENDAR_COLORS[status] : null;
                  const isSelected = selectedDays.some(sd => sd.day === day);
                  const isBulkSelected = bulkSelection.has(day);
                  const isToday = day === now.getDate() && isTodayInView;
                  const canRegularize = !!(status && !['PRESENT', 'HOLIDAY', 'ON_LEAVE'].includes(status));

                  return (
                    <div key={i} className="relative">
                      <button
                        onClick={() => handleDayClick(day)}
                        className={`relative flex w-full flex-col items-center justify-center rounded-lg text-sm transition-all duration-150 active:scale-95
                          ${color ? `${color.bg} ${color.text}` : 'hover:bg-gray-50 text-ink'}
                          ${isBulkSelected ? 'ring-2 ring-accent ring-offset-1' : ''}
                          ${isSelected && !bulkMode ? 'ring-2 ring-accent ring-offset-1 scale-[1.02]' : ''}
                          ${isToday ? 'font-bold' : ''}
                          min-h-[40px] sm:min-h-[60px] cursor-pointer
                        `}
                      >
                        {/* Day number */}
                        <span className={`text-[11px] leading-tight sm:text-sm ${color?.text || 'text-ink'} ${isToday && !color ? 'text-accent' : ''}`}>
                          {day}
                        </span>

                        {/* Status indicator */}
                        {status && (
                          <span className="mt-0.5 hidden text-[7px] font-semibold uppercase tracking-tight opacity-70 sm:block">
                            {CALENDAR_COLORS[status]?.label || status.replace('_', ' ')}
                          </span>
                        )}

                        {/* Worked minutes indicator */}
                        {rec?.workedMinutes != null && (
                          <span className={`mt-0.5 text-[8px] opacity-60 sm:text-[9px] ${color?.text || 'text-ink'}`}>
                            {formatDuration(rec.workedMinutes)}
                          </span>
                        )}

                        {/* Holiday name */}
                        {holidayName && (
                          <span className="mt-0.5 max-w-full truncate px-0.5 text-[6px] opacity-70 sm:text-[7px]">
                            🎉 {holidayName}
                          </span>
                        )}

                        {/* "Needs Regularization" indicator */}
                        {canRegularize && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber/40" />
                            <span className="relative inline-flex h-full w-full rounded-full bg-amber" />
                          </span>
                        )}

                        {/* Today indicator */}
                        {isToday && !color && (
                          <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-accent" />
                        )}

                        {/* Bulk selection checkbox */}
                        {bulkMode && (
                          <div className={`absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-sm border text-[8px] sm:h-5 sm:w-5 sm:text-[10px] ${
                            isBulkSelected ? 'bg-accent border-accent text-white' : 'bg-white border-gray-300'
                          }`}>
                            {isBulkSelected ? '✓' : ''}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-ink-faint sm:text-xs">
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> Present</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-100 border border-red-200" /> Absent</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 border border-amber-200" /> Late</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-100 border border-orange-200" /> Half Day</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-100 border border-blue-200" /> Leave</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-100 border border-purple-200" /> Holiday</span>
              </div>

              {/* Bulk actions bar */}
              {bulkMode && bulkSelection.size > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-accent-soft px-4 py-3">
                  <p className="text-sm font-medium text-accent">
                    {bulkSelection.size} day{bulkSelection.size > 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setBulkSelection(new Set())} className="h-8 text-xs">
                      Clear
                    </Button>
                    <Button size="sm" onClick={handleBulkSubmit} className="h-8 text-xs">
                      <Send size={12} className="mr-1" />
                      Regularize All
                    </Button>
                  </div>
                </div>
              )}

              {/* Hint */}
              {!bulkMode && (
                <p className="mt-3 text-center text-[10px] text-ink-faint sm:text-xs">
                  Click on a <span className="text-amber-600 font-medium">colored day</span> to submit a regularization request.
                  {' '}Use <strong>Bulk</strong> mode to select multiple days.
                </p>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-ink-faint">No calendar data.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── MONTHLY STATS SNAPSHOT ─── */}
      {monthStats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          {Object.entries(monthStats).map(([st, count]) => {
            const color = CALENDAR_COLORS[st];
            const Icon = STATUS_ICONS[st] || Clock;
            return (
              <div key={st} className={`rounded-xl border p-3 text-center transition-colors hover:shadow-sm ${color?.bg || 'bg-gray-50'} border-transparent`}>
                <Icon size={14} className={`mx-auto mb-1 ${color?.text || 'text-ink-faint'}`} />
                <p className={`text-sm font-semibold sm:text-lg ${color?.text || 'text-ink'}`}>{count}</p>
                <p className={`text-[9px] font-medium opacity-70 sm:text-[10px] ${color?.text || 'text-ink-faint'}`}>
                  {st.replace('_', ' ')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── REGULARIZATION HISTORY ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History size={16} />
            Request History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-faint" />
            </div>
          ) : historyData && historyData.items.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3">Requested</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyData.items.map((req) => (
                      <tr key={req.id} className="transition-colors hover:bg-ink-soft/5">
                        <td className="px-5 py-3 text-sm font-medium text-ink">{formatDate(req.date)}</td>
                        <td className="max-w-[200px] truncate px-5 py-3 text-sm text-ink-soft" title={req.reason}>{req.reason}</td>
                        <td className="px-5 py-3 text-xs text-ink-soft">
                          {req.requestedCheckIn || req.requestedCheckOut || req.requestedStatus ? (
                            <div className="space-y-0.5">
                              {req.requestedCheckIn && <p>In: {formatDateTime(req.requestedCheckIn)}</p>}
                              {req.requestedCheckOut && <p>Out: {formatDateTime(req.requestedCheckOut)}</p>}
                              {req.requestedStatus && <Badge variant="default" className="text-[9px]">{req.requestedStatus}</Badge>}
                            </div>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={STATUS_TONES[req.status] || 'default'} className="text-[10px]">
                            {req.status === 'PENDING' && <AlertCircle size={10} className="mr-1" />}
                            {req.status === 'APPROVED' && <CheckCircle size={10} className="mr-1" />}
                            {req.status === 'REJECTED' && <XCircle size={10} className="mr-1" />}
                            {req.status}
                          </Badge>
                        </td>
                        <td className="max-w-[180px] px-5 py-3 text-xs text-ink-soft">
                          {req.status === 'REJECTED' && req.rejectionReason ? (
                            <span className="text-danger">{req.rejectionReason}</span>
                          ) : req.status === 'APPROVED' ? (
                            <span className="text-emerald-600">✓ Approved</span>
                          ) : (
                            <span className="text-ink-faint">Awaiting review</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-border sm:hidden">
                {historyData.items.map((req) => (
                  <div key={req.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{formatDate(req.date)}</span>
                      <Badge tone={STATUS_TONES[req.status] || 'default'} className="text-[9px]">
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-soft line-clamp-2">{req.reason}</p>
                    {(req.requestedCheckIn || req.requestedCheckOut) && (
                      <p className="text-[10px] text-ink-faint">
                        {req.requestedCheckIn && `In: ${formatDateTime(req.requestedCheckIn)}`}
                        {req.requestedCheckIn && req.requestedCheckOut && ' · '}
                        {req.requestedCheckOut && `Out: ${formatDateTime(req.requestedCheckOut)}`}
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <p className="text-[10px] text-danger">Reason: {req.rejectionReason}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-ink-faint">
                    Page {historyData.meta.page} of {historyData.meta.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={historyPage >= historyData.meta.totalPages} onClick={() => setHistoryPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <FileText size={28} className="text-ink-faint/50" />
              <p className="text-sm text-ink-faint">No regularization requests yet.</p>
              <p className="text-xs text-ink-faint">Click on a day above to submit your first request.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── REGULARIZATION DRAWER ─── */}
      {drawerOpen && (
        <RegularizationDrawer
          selectedDays={selectedDays}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
          isPending={isSubmitting}
          error={formError}
        />
      )}
    </div>
  );
}
