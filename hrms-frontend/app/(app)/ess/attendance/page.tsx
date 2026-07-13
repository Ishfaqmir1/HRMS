'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Camera, FileText,
  Coffee, X, ExternalLink, Timer, Sun, UserCheck, AlertTriangle,
  Smartphone, Shield, QrCode, LogIn, LogOut, CircleCheckBig,
  CalendarDays, BarChart3, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

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

interface TodayRecord {
  id: string;
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

function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

function generateDeviceId(): string {
  const nav = navigator as any;
  const screen = window.screen;
  const components = [
    navigator.userAgent, navigator.language,
    screen.width, screen.height, screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency, nav.deviceMemory || '',
  ];
  const fingerprint = components.join('|||');
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `web-${Math.abs(hash).toString(16)}`;
}

// ──────────────────────────────────────────────────────────
// Day Detail Panel (slide-over)
// ──────────────────────────────────────────────────────────

function DayDetailPanel({
  record, holidayName, onClose,
}: {
  record: CalendarDayRecord | null;
  holidayName: string | null;
  onClose: () => void;
}) {
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

  // Build interactive map view for clock-in/out locations
  const hasInLocation = record.checkInLat != null && record.checkInLng != null;
  const hasOutLocation = record.checkOutLat != null && record.checkOutLng != null;
  const mapCenterLat = record.checkInLat ?? record.checkOutLat ?? 0;
  const mapCenterLng = record.checkInLng ?? record.checkOutLng ?? 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm drawer-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md animate-slide-right border-l border-border bg-white shadow-2xl"
      >
        <div className="flex h-full flex-col">
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
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">Timeline</p>
                <div className="relative space-y-0">
                  <TimelineItem
                    icon={MapPin}
                    color="text-accent"
                    bg="bg-accent-soft"
                    time={record.checkIn}
                    label="Clock In"
                    extra={record.source ? (
                      <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                        <SourceIcon size={8} /> via {record.source}
                      </span>
                    ) : undefined}
                  />
                  {record.breaks && record.breaks.length > 0 && record.breaks.map((b, i) => (
                    <TimelineItem
                      key={b.id}
                      icon={Coffee}
                      color="text-amber"
                      bg="bg-amber-soft"
                      time={b.startTime}
                      label={`Break ${i + 1}${b.endTime ? ` → ${formatTime(b.endTime)}` : ' (ongoing)'}`}
                      extra={b.durationMinutes != null ? (
                        <span className="text-[10px] text-ink-faint">{formatDuration(b.durationMinutes)}</span>
                      ) : undefined}
                    />
                  ))}
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

              <section className="rounded-xl bg-ink-soft/5 p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatBox label="Worked" value={formatDuration(record.workedMinutes)} />
                  <StatBox label="Break" value={formatDuration(record.breakMinutes)} />
                  <StatBox label="Overtime" value={formatDuration(record.overtimeMinutes)} highlight={!!record.overtimeMinutes && record.overtimeMinutes > 0} />
                  <StatBox label="Late" value={record.lateMinutes != null ? `${record.lateMinutes}m` : '—'} highlight={!!record.lateMinutes && record.lateMinutes > 0} />
                </div>
              </section>

              {/* Interactive Map — greythr-style location display */}
              {(hasInLocation || hasOutLocation) && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">📍 Location</p>

                  {/* OpenStreetMap interactive map — works without API key like greythr */}
                  <div className="mb-3 overflow-hidden rounded-xl border border-border">
                    <div className="relative h-40 w-full bg-gray-100">
                      <iframe
                        title="Clock location map"
                        className="h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenterLng - 0.02},${mapCenterLat - 0.02},${mapCenterLng + 0.02},${mapCenterLat + 0.02}&layer=mapnik&marker=${mapCenterLat},${mapCenterLng}`}
                      />

                      {/* Location info overlay */}
                      <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
                        {hasInLocation && (
                          <span className="rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-medium text-accent shadow-xs backdrop-blur-sm">
                            📍 Clock-in location
                          </span>
                        )}
                        {hasOutLocation && (
                          <span className="rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-medium text-amber shadow-xs backdrop-blur-sm">
                            📍 Clock-out location
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location links */}
                  <div className="space-y-1.5">
                    {record.checkInLat != null && (
                      <a href={getGoogleMapsLink(record.checkInLat, record.checkInLng!)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border p-2.5 transition-colors hover:bg-accent-soft"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-accent" />
                          <span className="text-xs text-ink-soft">Clock-in location</span>
                        </div>
                        <ExternalLink size={12} className="text-ink-faint" />
                      </a>
                    )}
                    {record.checkOutLat != null && (
                      <a href={getGoogleMapsLink(record.checkOutLat, record.checkOutLng!)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border p-2.5 transition-colors hover:bg-accent-soft"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-amber" />
                          <span className="text-xs text-ink-soft">Clock-out location</span>
                        </div>
                        <ExternalLink size={12} className="text-ink-faint" />
                      </a>
                    )}
                  </div>
                </section>
              )}

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

              {record.notes && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Notes</p>
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-ink-soft/5 p-3">
                    <FileText size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                    <p className="text-sm text-ink-soft">{record.notes}</p>
                  </div>
                </section>
              )}

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Day Info</p>
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <span>{dayName}</span>
                  <span className="text-ink-faint">·</span>
                  <span>{formatDateShort(record.date)}</span>
                </div>
              </section>
            </div>
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
      {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon size={14} className={color} />
      </div>
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

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-serif text-lg font-semibold ${highlight ? 'text-amber' : 'text-ink'}`}>{value}</p>
      <p className="text-[10px] text-ink-faint uppercase tracking-wider">{label}</p>
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

// ═══════════════════════════════════════════════════════════
// CLOCK-IN HERO CARD — Greythr-inspired attendance widget
// ═══════════════════════════════════════════════════════════

function ClockInHeroCard({
  today,
  todayLoading,
  isPending,
  error,
  onClockIn,
  onClockOut,
  profile,
}: {
  today: TodayRecord | null;
  todayLoading: boolean;
  isPending: boolean;
  error: any;
  onClockIn: () => void;
  onClockOut: () => void;
  profile?: { shift?: { name: string; startTime: string; endTime: string } | null } | null;
}) {
  const now = new Date();
  const todayStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const [mobileClockExpanded, setMobileClockExpanded] = useState(false);
  const isClockedIn = !!today?.checkIn;
  const isClockedOut = !!today?.checkOut;
  const status = today?.status || 'NOT_CLOCKED_IN';

  // Worked progress — as a percentage of a standard 8h day
  const workedMinutes = today?.workedMinutes ?? 0;
  const workedProgress = Math.min((workedMinutes / (8 * 60)) * 100, 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-300">
      {/* Accent gradient header */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent/60 to-accent-soft" />

      <div className="p-4 sm:p-8">
        {/* Mobile: collapsible greeting row */}
        <div className="flex items-start justify-between sm:hidden">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">{todayStr}</p>
            <h2 className="mt-0.5 font-serif text-lg font-semibold text-ink truncate">
              {isClockedIn ? 'Good work today!' : 'Ready to start?'}
            </h2>
            {profile?.shift && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-soft">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">{profile.shift.name}</span>
                <span>{profile.shift.startTime}–{profile.shift.endTime}</span>
              </div>
            )}
          </div>
          {/* Mobile clock button — compact */}
          <div className="shrink-0 ml-3">
            {todayLoading ? (
              <div className="skeleton h-14 w-14 rounded-full" />
            ) : !isClockedIn ? (
              <button
                onClick={onClockIn}
                disabled={isPending}
                className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-white shadow-lg shadow-accent/30 transition-all duration-300 active:scale-90 disabled:opacity-60"
              >
                <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
                <LogIn size={16} className="relative" />
              </button>
            ) : !isClockedOut ? (
              <button
                onClick={onClockOut}
                disabled={isPending}
                className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber/80 text-white shadow-lg shadow-amber/30 transition-all duration-300 active:scale-90 disabled:opacity-60"
              >
                <LogOut size={16} className="relative" />
              </button>
            ) : (
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-accent-soft text-accent">
                <CircleCheckBig size={18} />
              </div>
            )}
          </div>
        </div>

        {/* Mobile: expandable details */}
        <div className={`mt-3 space-y-3 overflow-hidden transition-all duration-300 sm:hidden ${mobileClockExpanded ? 'max-h-96' : 'max-h-0'}`}>
          {/* Today's timeline mini */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-[9px] text-ink-faint">In</p>
              <p className="font-semibold text-ink">{formatTime(today?.checkIn)}</p>
            </div>
            <div>
              <p className="text-[9px] text-ink-faint">Worked</p>
              <p className="font-semibold text-ink">{formatDuration(workedMinutes)}</p>
            </div>
            <div>
              <p className="text-[9px] text-ink-faint">Out</p>
              <p className="font-semibold text-ink">{formatTime(today?.checkOut)}</p>
            </div>
          </div>
          {isClockedIn && workedProgress > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-soft/10">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60 transition-all" style={{ width: `${workedProgress}%` }} />
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error?.response?.data?.message || error?.message}</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/ess/attendance/report" className="rounded-lg bg-ink-soft/5 px-2.5 py-1.5 text-[10px] font-medium text-ink-soft">📊 Report</Link>
            <Link href="/ess/leave" className="rounded-lg bg-ink-soft/5 px-2.5 py-1.5 text-[10px] font-medium text-ink-soft">📅 Leave</Link>
            <Link href="/ess/attendance/regularization" className="rounded-lg bg-ink-soft/5 px-2.5 py-1.5 text-[10px] font-medium text-ink-soft">✏️ Regularize</Link>
          </div>
        </div>

        {/* Mobile: toggle expand / desktop: always show */}
        <button
          onClick={() => setMobileClockExpanded(!mobileClockExpanded)}
          className="mt-1 flex w-full items-center justify-center text-[9px] text-ink-faint transition-colors hover:text-ink sm:hidden"
        >
          {mobileClockExpanded ? 'Show less ▲' : 'Show details ▼'}
        </button>

        {/* Desktop layout — hidden on mobile, shown on sm+ */}
        <div className="hidden sm:flex sm:flex-col sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Greeting + Shift Info */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{todayStr}</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
                {isClockedIn ? 'Good work today!' : 'Ready to start your day?'}
              </h2>
            </div>

            {/* Shift info */}
            {profile?.shift ? (
              <div className="flex items-center gap-3 text-sm text-ink-soft">
                <div className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-1.5">
                  <Clock size={14} className="text-accent" />
                  <span className="font-medium text-accent">{profile.shift.name}</span>
                </div>
                <span>{profile.shift.startTime} – {profile.shift.endTime}</span>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">No shift assigned</p>
            )}

            {/* Today's timeline */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isClockedIn ? 'bg-accent-soft' : 'bg-ink-soft/5'}`}>
                  <LogIn size={18} className={isClockedIn ? 'text-accent' : 'text-ink-faint'} />
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Clock In</p>
                  <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkIn)}</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${isClockedIn ? 'bg-accent/40' : 'bg-border'}`} style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isClockedOut ? 'bg-accent-soft' : isClockedIn ? 'bg-amber-soft' : 'bg-ink-soft/5'}`}>
                  <LogOut size={18} className={isClockedOut ? 'text-accent' : isClockedIn ? 'text-amber' : 'text-ink-faint'} />
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Clock Out</p>
                  <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkOut)}</p>
                </div>
              </div>
            </div>

            {/* Worked hours bar */}
            {isClockedIn && (
              <div className="space-y-1.5 max-w-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-soft">
                    <Timer size={12} className="mr-1 inline" />
                    {formatDuration(workedMinutes)} worked
                  </span>
                  <span className="text-ink-faint">{Math.round(workedProgress)}% of 8h</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-soft/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-700 ease-out"
                    style={{ width: `${workedProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-ink-faint">
                  {today?.breakMinutes != null && today.breakMinutes > 0 && (
                    <span><Coffee size={10} className="mr-0.5 inline" /> Break: {formatDuration(today.breakMinutes)}</span>
                  )}
                  {today?.overtimeMinutes != null && today.overtimeMinutes > 0 && (
                    <span className="text-accent">+ OT: {formatDuration(today.overtimeMinutes)}</span>
                  )}
                  {today?.lateMinutes != null && today.lateMinutes > 0 && (
                    <span className="text-amber">Late: {today.lateMinutes}m</span>
                  )}
                </div>
              </div>
            )}

            {/* Status badges */}
            {isClockedIn && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(status)} className="text-[10px]">
                  {status.replace('_', ' ')}
                </Badge>
                {today?.source && (
                  <Badge tone="default" className="text-[10px]">
                    via {today.source}
                  </Badge>
                )}
                {today?.checkInLat && (
                  <Badge tone="success" className="text-[10px]">
                    <MapPin size={8} className="mr-0.5" /> GPS Verified
                  </Badge>
                )}
                <Link
                  href="/ess/attendance/regularization"
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
                >
                  Regularize <ArrowRight size={10} />
                </Link>
              </div>
            )}
          </div>

          {/* Desktop: Big Clock In/Out Button */}
          <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-3">
            {todayLoading ? (
              <div className="skeleton h-32 w-32 rounded-full" />
            ) : !isClockedIn ? (
              <button onClick={onClockIn} disabled={isPending}
                className="group relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-white shadow-lg shadow-accent/30 transition-all duration-300 hover:shadow-xl hover:shadow-accent/40 hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
                <span className="relative flex flex-col items-center">
                  <LogIn size={28} className="mb-1 transition-transform group-hover:translate-y-[-2px]" />
                  <span className="text-sm font-semibold">Clock In</span>
                </span>
              </button>
            ) : !isClockedOut ? (
              <button onClick={onClockOut} disabled={isPending}
                className="group relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber/80 text-white shadow-lg shadow-amber/30 transition-all duration-300 hover:shadow-xl hover:shadow-amber/40 hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                <LogOut size={28} className="mb-1 transition-transform group-hover:translate-y-[2px]" />
                <span className="text-sm font-semibold">Clock Out</span>
              </button>
            ) : (
              <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-accent-soft text-accent">
                <CircleCheckBig size={32} className="mb-1" />
                <span className="text-sm font-semibold">Done</span>
              </div>
            )}
            {!isClockedOut && (
              <p className="text-[10px] text-ink-faint text-center max-w-[140px] leading-tight">
                {isPending ? '⏳ Processing...' : isClockedIn ? 'Don\'t forget to clock out!' : 'Tap to start your shift'}
              </p>
            )}
          </div>
        </div>

        {/* Desktop error */}
        {error && (
          <div className="mt-4 hidden sm:block rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
            {error?.response?.data?.message || error?.message || 'Something went wrong.'}
          </div>
        )}

        {/* Quick links — desktop only */}
        <div className="mt-6 hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3 border-t border-border pt-4">
          <Link href="/ess/attendance/report" className="flex items-center gap-1.5 rounded-lg bg-ink-soft/5 px-3 py-2 text-xs font-medium text-ink-soft hover:bg-accent-soft hover:text-accent transition-colors">
            <BarChart3 size={14} /> View Report
          </Link>
          <Link href="/ess/leave" className="flex items-center gap-1.5 rounded-lg bg-ink-soft/5 px-3 py-2 text-xs font-medium text-ink-soft hover:bg-accent-soft hover:text-accent transition-colors">
            <CalendarDays size={14} /> Apply Leave
          </Link>
          <Link href="/ess/attendance/regularization" className="flex items-center gap-1.5 rounded-lg bg-ink-soft/5 px-3 py-2 text-xs font-medium text-ink-soft hover:bg-accent-soft hover:text-accent transition-colors">
            <FileText size={14} /> Regularize
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function AttendanceCalendarPage() {
  const queryClient = useQueryClient();
  const deviceIdRef = useRef(generateDeviceId());
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // ── Queries ──

  // Today's record (for clock-in/out)
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['me', 'today'],
    queryFn: () => unwrap<TodayRecord | null>(api.get('/attendance/me/today')),
    refetchInterval: 30_000, // Poll every 30s
  });

  // Profile for shift info
  const { data: profile } = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => unwrap<any>(api.get('/me/profile')),
  });

  // Calendar data
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'attendance-calendar', year, month],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year, month } })),
  });

  // ── Mutations ──

  const clockInMut = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentPosition();
      const body: Record<string, any> = {
        source: coords ? 'GPS' : 'WEB',
        deviceId: deviceIdRef.current,
        deviceName: 'Web Browser',
        browserInfo: navigator.userAgent,
        ...(coords && { lat: coords.lat, lng: coords.lng }),
        locationAccuracy: coords ? coords.accuracy : undefined,
      };
      return api.post('/attendance/clock-in', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'attendance-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const clockOutMut = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentPosition();
      const body: Record<string, any> = {
        deviceId: deviceIdRef.current,
        deviceName: 'Web Browser',
        browserInfo: navigator.userAgent,
        ...(coords && { lat: coords.lat, lng: coords.lng }),
      };
      return api.post('/attendance/clock-out', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'attendance-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  // ── Calendar Navigation ──

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

  const selectedRecord = selectedDay != null ? recordMap.get(selectedDay.toString()) ?? null : null;
  const selectedHoliday = selectedDay != null ? holidayMap.get(selectedDay.toString()) ?? null : null;

  const monthlySummary = useMemo(() => {
    if (!data?.records) return null;
    const counts: Record<string, number> = {};
    for (const st of ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE']) {
      counts[st] = data.records.filter(r => r.status === st).length;
    }
    return counts;
  }, [data]);

  const isTodayInView = month === now.getMonth() + 1 && year === now.getFullYear();

  const error = (clockInMut.error as any) || (clockOutMut.error as any);
  const isPending = clockInMut.isPending || clockOutMut.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Attendance</h1>
        <Link
          href="/ess/attendance/report"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-accent-soft hover:text-accent transition-colors"
        >
          <BarChart3 size={14} />
          Monthly Report
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* ─── GREYTHR-STYLE CLOCK-IN HERO ─── */}
      <ClockInHeroCard
        today={today ?? null}
        todayLoading={todayLoading}
        isPending={isPending}
        error={error}
        onClockIn={() => clockInMut.mutate()}
        onClockOut={() => clockOutMut.mutate()}
        profile={profile}
      />

      {/* ─── MONTHLY CALENDAR ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
              {isTodayInView && (
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-accent/40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
              )}
            </div>
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
                  const isToday = day === now.getDate() && isTodayInView;

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

      {/* ─── MONTHLY SUMMARY ─── */}
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

      {/* ─── DAY DETAIL SLIDE-OVER ─── */}
      <DayDetailPanel
        record={selectedRecord}
        holidayName={selectedHoliday}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
