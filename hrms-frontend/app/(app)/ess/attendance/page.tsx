'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Camera, FileText,
  Coffee, X, ExternalLink, Timer, Sun, UserCheck, AlertTriangle,
  Smartphone, Shield, QrCode,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface AttendancePhoto {
  id: string;
  photoType: 'CHECK_IN' | 'CHECK_OUT';
  imageUrl: string;
  faceMatchScore: number | null;
  createdAt: string;
}

interface AttendanceBreak {
  id: string;
  type: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
}

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
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  notes: string | null;
  isHoliday: boolean;
  photos: AttendancePhoto[];
  breaks: AttendanceBreak[];
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
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-accent text-white',
  ABSENT: 'bg-danger-soft text-danger',
  HALF_DAY: 'bg-amber-soft text-amber',
  LATE: 'bg-amber-soft text-amber',
  ON_LEAVE: 'bg-ink-soft/10 text-ink-faint',
  HOLIDAY: 'bg-accent-soft text-accent',
  WEEK_OFF: 'bg-ink-soft/5 text-ink-faint',
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

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getGoogleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'QR': return QrCode;
    case 'FACE': return Camera;
    case 'GPS': return MapPin;
    case 'MOBILE': return Smartphone;
    case 'WEB': return Shield;
    default: return Shield;
  }
}

// ──────────────────────────────────────────────────────────
// Day Detail Panel
// ──────────────────────────────────────────────────────────

function DayDetailPanel({
  record, holidayName, onClose,
}: {
  record: CalendarDayRecord | null;
  holidayName: string | null;
  onClose: () => void;
}) {
  // Close on Escape key (document-level, works regardless of focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!record && !holidayName) return null;

  if (holidayName && !record) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm drawer-backdrop" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={holidayName || ''}
          className="fixed inset-y-0 right-0 z-50 w-full max-w-md animate-slide-right border-l border-border bg-white shadow-2xl"
        >
          <div className="flex h-full flex-col">
            <Header title={holidayName} subtitle="Holiday" onClose={onClose} />
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center">
                <Sun size={48} className="mx-auto mb-4 text-accent-soft" />
                <p className="text-lg font-medium text-ink">{holidayName}</p>
                <p className="mt-1 text-sm text-ink-faint">Official holiday — no attendance required</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!record) return null;

  const Icon = STATUS_ICONS[record.status] || Shield;
  const inPhoto = record.photos?.find((p) => p.photoType === 'CHECK_IN');
  const outPhoto = record.photos?.find((p) => p.photoType === 'CHECK_OUT');
  const SourceIcon = getSourceIcon(record.source);
  const dayName = DAYS_FULL[new Date(record.date).getDay()];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm drawer-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Attendance details for ${formatDate(record.date)}`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md animate-slide-right border-l border-border bg-white shadow-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft">
                <Icon size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{record.status.replace('_', ' ')}</p>
                <p className="text-xs text-ink-faint">{formatDate(record.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(record.status)} className="text-[10px]">
                {record.status}
              </Badge>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-ink-soft/10 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">

              {/* Timeline */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">Timeline</p>
                <div className="relative space-y-0">
                  {/* Clock In */}
                  <TimelineItem
                    icon={MapPin}
                    color="text-accent"
                    bg="bg-accent-soft"
                    time={record.checkIn}
                    label="Clock In"
                    extra={
                      record.source ? (
                        <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                          <SourceIcon size={8} /> via {record.source}
                        </span>
                      ) : undefined
                    }
                  />

                  {/* Breaks */}
                  {record.breaks && record.breaks.length > 0 && record.breaks.map((b, i) => (
                    <TimelineItem
                      key={b.id}
                      icon={Coffee}
                      color="text-amber"
                      bg="bg-amber-soft"
                      time={b.startTime}
                      label={`Break ${i + 1}${b.endTime ? ` → ${formatTime(b.endTime)}` : ' (ongoing)'}`}
                      extra={
                        b.durationMinutes != null ? (
                          <span className="text-[10px] text-ink-faint">{formatDuration(b.durationMinutes)}</span>
                        ) : undefined
                      }
                    />
                  ))}

                  {/* Clock Out */}
                  <TimelineItem
                    icon={Timer}
                    color="text-ink"
                    bg="bg-ink-soft/10"
                    time={record.checkOut}
                    label="Clock Out"
                    isLast
                  />
                </div>
              </section>

              {/* Work Stats */}
              <section className="rounded-xl bg-ink-soft/5 p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatBox label="Worked" value={formatDuration(record.workedMinutes)} />
                  <StatBox label="Break" value={formatDuration(record.breakMinutes)} />
                  <StatBox label="Overtime" value={formatDuration(record.overtimeMinutes)} highlight={!!record.overtimeMinutes && record.overtimeMinutes > 0} />
                  <StatBox label="Late" value={record.lateMinutes != null ? `${record.lateMinutes}m` : '—'} highlight={!!record.lateMinutes && record.lateMinutes > 0} />
                </div>
              </section>

              {/* GPS Location */}
              {(record.checkInLat != null || record.checkOutLat != null) && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Location</p>
                  <div className="space-y-2">
                    {record.checkInLat != null && (
                      <a
                        href={getGoogleMapsLink(record.checkInLat, record.checkInLng!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent-soft"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-accent" />
                          <span className="text-sm text-ink-soft">Clock-in location</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-ink-faint">
                          {record.checkInLat.toFixed(4)}, {record.checkInLng?.toFixed(4)}
                          <ExternalLink size={10} className="ml-0.5" />
                        </div>
                      </a>
                    )}
                    {record.checkOutLat != null && (
                      <a
                        href={getGoogleMapsLink(record.checkOutLat, record.checkOutLng!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent-soft"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-amber" />
                          <span className="text-sm text-ink-soft">Clock-out location</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-ink-faint">
                          {record.checkOutLat.toFixed(4)}, {record.checkOutLng?.toFixed(4)}
                          <ExternalLink size={10} className="ml-0.5" />
                        </div>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {/* Photos */}
              {(inPhoto || outPhoto) && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Photos</p>
                  <div className={`grid gap-3 ${inPhoto && outPhoto ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {inPhoto && (
                      <div className="group relative overflow-hidden rounded-xl border border-border">
                        <img src={inPhoto.imageUrl} alt="Check-in selfie" className="h-32 w-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-[10px] text-white/90">Check-in</p>
                          {inPhoto.faceMatchScore != null && (
                            <p className="text-[9px] text-white/60">Match: {(inPhoto.faceMatchScore * 100).toFixed(0)}%</p>
                          )}
                        </div>
                      </div>
                    )}
                    {outPhoto && (
                      <div className="group relative overflow-hidden rounded-xl border border-border">
                        <img src={outPhoto.imageUrl} alt="Check-out selfie" className="h-32 w-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-[10px] text-white/90">Check-out</p>
                          {outPhoto.faceMatchScore != null && (
                            <p className="text-[9px] text-white/60">Match: {(outPhoto.faceMatchScore * 100).toFixed(0)}%</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Notes */}
              {record.notes && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Notes</p>
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-ink-soft/5 p-3">
                    <FileText size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                    <p className="text-sm text-ink-soft">{record.notes}</p>
                  </div>
                </section>
              )}

              {/* Day info */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Day Info</p>
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <span>{dayName}</span>
                  <span className="text-ink-faint">·</span>
                  <span>{formatDateShort(record.date)}</span>
                </div>
              </section>
            </div>

            {/* Spacer for safe area */}
            <div className="h-6" />
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-Components
// ──────────────────────────────────────────────────────────

function Header({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-faint">{subtitle}</p>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-ink-soft/10 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

function TimelineItem({
  icon: Icon, color, bg, time, label, extra, isLast,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  time: string | null | undefined;
  label: string;
  extra?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-4">
      {/* Connector line */}
      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}

      {/* Icon */}
      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon size={14} className={color} />
      </div>

      {/* Content */}
      <div className="flex-1 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{time ? formatTime(time) : '—'}</p>
          <p className="text-xs text-ink-faint">{label}</p>
        </div>
        {extra && <div className="mt-0.5">{extra}</div>}
      </div>
    </div>
  );
}

function StatBox({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`font-serif text-lg font-semibold ${highlight ? 'text-amber' : 'text-ink'}`}>{value}</p>
      <p className="text-[10px] text-ink-faint uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export default function AttendanceCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'attendance-calendar', year, month],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year, month } })),
  });

  const prevMonth = useCallback(() => {
    setSelectedDay(null);
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    setSelectedDay(null);
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }, [month]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build map of day -> record/holiday
  const recordMap = useMemo(() => {
    const map = new Map<string, CalendarDayRecord>();
    if (!data?.records) return map;
    data.records.forEach(r => {
      map.set(new Date(r.date).getDate().toString(), r);
    });
    return map;
  }, [data]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!data?.holidays) return map;
    data.holidays.forEach(h => {
      map.set(new Date(h.date).getDate().toString(), h.name);
    });
    return map;
  }, [data]);

  // Generate calendar cells
  const cells = useMemo(() => {
    const result: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(d);
    return result;
  }, [firstDay, daysInMonth]);

  const getDayStatus = useCallback((day: number): string | null => {
    if (holidayMap.has(day.toString())) return 'HOLIDAY';
    const rec = recordMap.get(day.toString());
    if (!rec) return null;
    return rec.status;
  }, [recordMap, holidayMap]);

  // Selected record for detail panel
  const selectedRecord = selectedDay != null ? recordMap.get(selectedDay.toString()) ?? null : null;
  const selectedHoliday = selectedDay != null ? holidayMap.get(selectedDay.toString()) ?? null : null;

  // Monthly summary
  const monthlySummary = useMemo(() => {
    if (!data?.records) return null;
    const counts: Record<string, number> = {};
    for (const st of ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE']) {
      counts[st] = data.records.filter(r => r.status === st).length;
    }
    return counts;
  }, [data]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Calendar</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight size={14} /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-1">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-ink-faint">{d}</div>
                ))}
                {[...Array(35)].map((_, i) => (
                  <div key={i} className="skeleton min-h-[56px] rounded-md" />
                ))}
              </div>
            </div>
          )}
          {data && (
            <>
              <div className="grid grid-cols-7 gap-1">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-ink-faint">{d}</div>
                ))}
                {cells.map((day, i) => {
                  const status = day ? getDayStatus(day) : null;
                  const holidayName = day ? holidayMap.get(day.toString()) : null;
                  const rec = day ? recordMap.get(day.toString()) : null;
                  const isSelected = day === selectedDay;
                  const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

                  return (
                    <button
                      key={i}
                      disabled={!day}
                      onClick={() => day && setSelectedDay(day)}
                      className={`relative flex min-h-[60px] flex-col items-center justify-center rounded-md text-sm transition-all duration-150 ${
                        day ? (
                          status
                            ? `${STATUS_STYLES[status] || 'hover:bg-ink-soft/10'} cursor-pointer active:scale-95`
                            : 'hover:bg-ink-soft/10 cursor-pointer active:scale-95'
                        ) : ''
                      } ${
                        isSelected ? 'ring-2 ring-accent ring-offset-2 scale-105 z-10' : ''
                      } ${
                        isToday && !isSelected ? 'ring-1 ring-accent/30' : ''
                      }`}
                    >
                      {day && (
                        <>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm font-medium ${status === 'PRESENT' ? 'text-white' : status ? '' : 'text-ink'}`}>
                              {day}
                            </span>
                            {isToday && (
                              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                              </span>
                            )}
                          </div>
                          {rec && rec.workedMinutes != null && (
                            <span className={`text-[10px] leading-tight ${
                              status === 'PRESENT' ? 'text-white/70' : 'opacity-70'
                            }`}>
                              {formatDuration(rec.workedMinutes)}
                            </span>
                          )}
                          {rec && rec.lateMinutes != null && rec.lateMinutes > 0 && (
                            <span className="text-[8px] font-semibold text-red-400">LATE</span>
                          )}
                          {holidayName && (
                            <span className="text-[8px] leading-tight text-center px-0.5 truncate max-w-full">
                              {holidayName}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-faint">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-accent" /> Present</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-danger-soft text-danger" /> Absent</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber-soft text-amber" /> Half Day / Late</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-accent-soft text-accent" /> Holiday</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-paper border border-border" /> Leave</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      {monthlySummary && (
        <Card>
          <CardHeader><CardTitle>Monthly Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(monthlySummary).map(([st, count]) => {
                const totalDays = data?.records.length || 1;
                const pct = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
                return (
                  <div key={st} className="rounded-lg border border-border p-3 text-center transition-colors hover:bg-ink-soft/5">
                    <p className="font-serif text-2xl font-semibold text-ink">{count}</p>
                    <p className="text-xs text-ink-faint">{st.replace('_', ' ')}</p>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-ink-soft/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          st === 'PRESENT' ? 'bg-accent' : st === 'ABSENT' ? 'bg-danger' : 'bg-ink-soft/30'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {data?.records && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Total Days" value={data.records.length.toString()} />
                <MiniStat
                  label="Avg Worked"
                  value={formatDuration(
                    Math.round(data.records.reduce((s, r) => s + (r.workedMinutes || 0), 0) / Math.max(data.records.filter(r => r.checkIn).length, 1))
                  )}
                />
                <MiniStat
                  label="Avg Clock In"
                  value={(() => {
                    const times = data.records.filter(r => r.checkIn).map(r => new Date(r.checkIn!).getTime());
                    if (times.length === 0) return '—';
                    const avg = new Date(times.reduce((s, t) => s + t, 0) / times.length);
                    return avg.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  })()}
                />
                <MiniStat label="Break Total" value={formatDuration(
                  data.records.reduce((s, r) => s + (r.breakMinutes || 0), 0)
                )} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day Detail Slide-Over Panel */}
      <DayDetailPanel
        record={selectedRecord}
        holidayName={selectedHoliday}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-soft/5 p-3 text-center">
      <p className="text-xs font-medium text-ink">{value}</p>
      <p className="text-[10px] text-ink-faint uppercase tracking-wider">{label}</p>
    </div>
  );
}
