'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, QrCode, Camera, Smartphone, Shield, ChevronDown, ChevronUp,
  CheckCircle, Lock, Wifi, Globe, Clock, Users, UserCheck, UserX,
  AlertTriangle, Search, Plus, Pencil, Trash2, CalendarDays,
  RefreshCw, FilterX,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { AttendanceRecord, PaginatedResult, Department, Employee } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import QRDisplay from '@/components/attendance-security/qr-display';
import QRScanner from '@/components/attendance-security/qr-scanner';
import FaceCapture from '@/components/attendance-security/face-capture';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface AttendanceRecordWithEmployee extends AttendanceRecord {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
}

interface ManualEntryForm {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  notes: string;
}

interface EditRecordForm {
  checkIn: string;
  checkOut: string;
  status: string;
  notes: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getWeekAgoString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
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

function getWifiInfo(): { ssid?: string } {
  const conn = (navigator as any).connection;
  if (conn?.type === 'wifi') return { ssid: conn.ssid || 'office-wifi' };
  return {};
}

async function getPublicIp(): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1000) });
    return (await res.json()).ip;
  } catch { return undefined; }
}

type SecurityTab = 'none' | 'qr-display' | 'qr-scan' | 'face' | 'device';

const EMPTY_MANUAL_FORM: ManualEntryForm = {
  employeeId: '', date: getTodayString(), checkIn: '', checkOut: '', status: 'PRESENT', notes: '',
};

const EMPTY_EDIT_FORM: EditRecordForm = {
  checkIn: '', checkOut: '', status: 'PRESENT', notes: '',
};

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const deviceIdRef = useRef(generateDeviceId());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [securityTab, setSecurityTab] = useState<SecurityTab>('none');
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [faceData, setFaceData] = useState<{ faceEncoding?: number[]; livenessResult?: { passed: boolean; method?: string } }>({});
  const [qrCode, setQrCode] = useState<string | null>(null);

  // ── Filters ──
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterFrom, setFilterFrom] = useState(getWeekAgoString());
  const [filterTo, setFilterTo] = useState(getTodayString());
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // ── Dialogs ──
  const [manualOpen, setManualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualEntryForm>(EMPTY_MANUAL_FORM);
  const [editForm, setEditForm] = useState<EditRecordForm>(EMPTY_EDIT_FORM);

  // ── Queries ──

  // Employees for manual entry dialog
  const { data: employeesForManual } = useQuery({
    queryKey: ['employees', 'list', { limit: 500 }],
    queryFn: () => unwrap<PaginatedResult<Employee>>(api.get('/employees', { params: { limit: 500 } })),
    select: (data) => data.items,
  });

  // Departments for filter dropdown (paginated API)
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => unwrap<PaginatedResult<Department>>(api.get('/departments')),
    select: (data) => data.items,
  });

  // Today's attendance (self-service)
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => unwrap<AttendanceRecord | null>(api.get('/attendance/me/today')),
  });

  // Self history (compact, for the self-service panel)
  const { data: selfHistory } = useQuery({
    queryKey: ['attendance', 'self-history'],
    queryFn: () => unwrap<PaginatedResult<AttendanceRecord>>(
      api.get('/attendance/me/history', { params: { limit: 5 } }),
    ),
  });

  // Management list — all attendance records for the company with filters
  const listParams = useMemo(() => {
    const params: Record<string, any> = { page, limit };
    if (filterFrom) params.from = filterFrom;
    if (filterTo) params.to = filterTo;
    if (filterEmployee) params.employeeId = filterEmployee;
    if (filterDepartment) params.departmentId = filterDepartment;
    return params;
  }, [page, limit, filterFrom, filterTo, filterEmployee, filterDepartment]);

  const { data: rawRecords, isLoading: listLoading, isError: listError, error: listErr } = useQuery({
    queryKey: ['attendance', 'all', listParams],
    queryFn: () => unwrap<PaginatedResult<AttendanceRecordWithEmployee>>(
      api.get('/attendance', { params: listParams }),
    ),
  });

  // Client-side status filtering (backend doesn't support status param)
  const allRecords = useMemo(() => {
    if (!rawRecords) return rawRecords;
    if (!filterStatus) return rawRecords;
    const filtered = rawRecords.items.filter((r) => r.status === filterStatus);
    return {
      items: filtered,
      meta: { ...rawRecords.meta, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    };
  }, [rawRecords, filterStatus, limit]);

  // Today's summary stats (fetch today's records and compute)
  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ['attendance', 'today-stats', filterFrom, filterTo],
    queryFn: async (): Promise<AttendanceSummary> => {
      const result = await unwrap<PaginatedResult<AttendanceRecord>>(
        api.get('/attendance', { params: { from: filterFrom, to: filterTo, limit: 500 } }),
      );
      const items = result.items || [];
      return {
        total: result.meta.total,
        present: items.filter((r) => r.status === 'PRESENT').length,
        absent: items.filter((r) => r.status === 'ABSENT').length,
        late: items.filter((r) => r.status === 'LATE').length,
        halfDay: items.filter((r) => r.status === 'HALF_DAY').length,
        onLeave: items.filter((r) => r.status === 'ON_LEAVE').length,
      };
    },
  });

  // Devices for security
  const { data: devices } = useQuery({
    queryKey: ['attendance-security', 'devices'],
    queryFn: async () => { const res = await api.get('/attendance-security/devices'); return res.data?.data || res.data; },
    retry: false,
  });

  const { data: securityConfig } = useQuery({
    queryKey: ['attendance-security', 'config-summary'],
    queryFn: async () => { const res = await api.get('/attendance-security/config/summary'); return res.data?.data || res.data; },
    retry: false,
  });

  // ── Invalidation ──
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  // ── Self-Service Mutations ──
  const clockInMut = useMutation({
    mutationFn: async (overrides?: Record<string, any>) => {
      const coords = await getCurrentPosition();
      const wifi = getWifiInfo();
      const ip = await getPublicIp();
      const trustedDevice = Array.isArray(devices) ? devices.find((d: any) => d.isTrusted) : null;
      const body: Record<string, any> = {
        source: coords ? 'GPS' : 'WEB',
        deviceId: trustedDevice?.deviceId || deviceIdRef.current,
        deviceName: trustedDevice?.deviceName || 'Web Browser',
        browserInfo: navigator.userAgent,
        wifiSsid: wifi.ssid,
        ipAddress: ip,
        ...(coords && { lat: coords.lat, lng: coords.lng }),
        locationAccuracy: coords ? coords.accuracy : undefined,
        ...(qrCode ? { qrCode } : {}),
        ...faceData,
        ...overrides,
      };
      return api.post('/attendance/clock-in', body);
    },
    onSuccess: () => { invalidate(); setSecurityTab('none'); },
  });

  const clockOutMut = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentPosition();
      const trustedDevice = Array.isArray(devices) ? devices.find((d: any) => d.isTrusted) : null;
      const body: Record<string, any> = {
        deviceId: trustedDevice?.deviceId || deviceIdRef.current,
        deviceName: trustedDevice?.deviceName || 'Web Browser',
        browserInfo: navigator.userAgent,
        ...(coords && { lat: coords.lat, lng: coords.lng }),
        ...faceData,
      };
      return api.post('/attendance/clock-out', body);
    },
    onSuccess: () => { invalidate(); setSecurityTab('none'); },
  });

  const registerDevice = useMutation({
    mutationFn: () => api.post('/attendance-security/devices/register', {
      deviceId: deviceIdRef.current,
      deviceName: 'Web Browser',
      platform: 'web',
      browserInfo: navigator.userAgent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-security'] });
      setSecurityTab('none');
    },
  });

  // ── Management Mutations ──
  const createManualMut = useMutation({
    mutationFn: (data: ManualEntryForm) => api.post('/attendance', data),
    onSuccess: () => { invalidate(); setManualOpen(false); setManualForm(EMPTY_MANUAL_FORM); },
  });

  const updateRecordMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditRecordForm }) => api.patch(`/attendance/${id}`, data),
    onSuccess: () => { invalidate(); setEditOpen(false); setEditRecordId(null); },
  });

  const deleteRecordMut = useMutation({
    mutationFn: (id: string) => api.delete(`/attendance/${id}`),
    onSuccess: () => { invalidate(); setDeleteOpen(false); setDeleteRecordId(null); },
  });

  async function handleClockIn() {
    if (securityConfig?.config?.requireQrScan && !qrCode) { setSecurityTab('qr-scan'); return; }
    setGpsStatus('locating');
    clockInMut.mutate(undefined);
  }

  async function handleClockOut() {
    setGpsStatus('locating');
    clockOutMut.mutate(undefined);
  }

  function openEdit(record: AttendanceRecordWithEmployee) {
    setEditRecordId(record.id);
    setEditForm({
      checkIn: record.checkIn || '',
      checkOut: record.checkOut || '',
      status: record.status,
      notes: '',
    });
    setEditOpen(true);
  }

  function confirmDelete(id: string) {
    setDeleteRecordId(id);
    setDeleteOpen(true);
  }

  // ── Filter reset ──
  function resetFilters() {
    setFilterEmployee('');
    setFilterDepartment('');
    setFilterFrom(getWeekAgoString());
    setFilterTo(getTodayString());
    setFilterStatus('');
    setPage(1);
  }

  // ── Derived ──
  const error = (clockInMut.error as any) || (clockOutMut.error as any);
  const isPending = clockInMut.isPending || clockOutMut.isPending;
  const isDeviceRegistered = Array.isArray(devices) && devices.length > 0;

  const totalPages = allRecords?.meta?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Attendance</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {securityConfig?.activeLayerCount
              ? `${securityConfig.activeLayerCount}/${securityConfig.totalLayerCount} security layers active`
              : 'Secure attendance tracking'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs text-ink-faint">
            <CalendarDays size={12} />
            {formatDate(filterFrom)} – {formatDate(filterTo)}
          </div>
          <Badge tone={securityConfig?.securityScore >= 70 ? 'success' : 'warning'}>
            <Shield size={10} className="mr-1" />
            {securityConfig?.securityScore ?? 0}% Secure
          </Badge>
        </div>
      </div>

      {/* ─── Summary Stats ─── */}
      <div className="stagger-enter grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statsLoading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bento-card">
                <div className="skeleton mb-2 h-3 w-16" />
                <div className="skeleton h-7 w-12" />
              </div>
            ))}
          </>
        ) : (
          <>
            <SummaryCard
              label="Total"
              value={todayStats?.total ?? 0}
              icon={Users}
              color="text-ink"
              bg="bg-ink-soft/5"
            />
            <SummaryCard
              label="Present"
              value={todayStats?.present ?? 0}
              icon={UserCheck}
              color="text-accent"
              bg="bg-accent-soft"
            />
            <SummaryCard
              label="Absent"
              value={todayStats?.absent ?? 0}
              icon={UserX}
              color="text-danger"
              bg="bg-danger-soft"
            />
            <SummaryCard
              label="Late"
              value={todayStats?.late ?? 0}
              icon={AlertTriangle}
              color="text-amber"
              bg="bg-amber-soft"
            />
            <SummaryCard
              label="Half Day"
              value={todayStats?.halfDay ?? 0}
              icon={Clock}
              color="text-amber"
              bg="bg-amber-soft"
            />
            <SummaryCard
              label="On Leave"
              value={todayStats?.onLeave ?? 0}
              icon={CalendarDays}
              color="text-ink-soft"
              bg="bg-ink-soft/5"
            />
          </>
        )}
      </div>

      {/* ─── Self-Service Clock In/Out ─── */}
      <Card hover glass>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`pulse-dot ${today?.checkIn && !today?.checkOut ? '' : 'opacity-0'}`} />
              <CardTitle className="text-sm">Self-Service</CardTitle>
            </div>
            <Badge tone={today?.checkIn ? 'success' : 'default'} className="text-[10px]">
              {today?.checkIn ? (today?.checkOut ? 'Clocked Out' : 'Clocked In') : 'Not Clocked In'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <div className="flex gap-4">
              <div className="skeleton h-10 w-24" />
              <div className="skeleton h-10 w-24" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-6 text-sm text-ink-soft">
                  <div>
                    <p className="text-xs text-ink-faint">Clock in</p>
                    <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">Clock out</p>
                    <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkOut)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">Worked</p>
                    <p className="font-serif text-lg font-semibold text-ink">{formatDuration(today?.workedMinutes)}</p>
                  </div>
                  {/* Show recent self history quick summary */}
                  {selfHistory && selfHistory.items.length > 0 && (
                    <div className="hidden sm:block">
                      <p className="text-xs text-ink-faint">Last shift</p>
                      <p className="text-sm font-medium text-ink-soft">
                        {formatDuration(selfHistory.items[0]?.workedMinutes)} · {formatDate(selfHistory.items[0]?.date)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleClockIn}
                      isLoading={isPending}
                      disabled={!!today?.checkIn}
                      className="relative overflow-hidden"
                    >
                      {gpsStatus === 'locating' ? '📍 Locating…' : 'Clock In'}
                      {!today?.checkIn && (
                        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white/70" />
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleClockOut}
                      isLoading={isPending}
                      disabled={!today?.checkIn || !!today?.checkOut}
                    >
                      Clock Out
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {today?.checkInLat != null && (
                      <span className="flex items-center gap-1 text-xs text-ink-faint">
                        <MapPin size={10} /> GPS
                      </span>
                    )}
                    {today?.source && (
                      <Badge tone="default" className="text-[10px]">{today.source}</Badge>
                    )}
                    <Badge tone={today?.checkIn ? 'success' : 'default'} className="text-[10px]">
                      {today?.status || '—'}
                    </Badge>
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error?.response?.data?.message || error?.message || 'Something went wrong.'}
                </p>
              )}

              {/* Security layer badges */}
              {today && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {today.checkInLat && <Badge tone="success" className="text-[10px]"><MapPin size={8} className="mr-0.5" /> GPS</Badge>}
                  {today.source === 'FACE' && <Badge tone="success" className="text-[10px]"><Camera size={8} className="mr-0.5" /> Face</Badge>}
                  {today.source === 'QR' && <Badge tone="success" className="text-[10px]"><QrCode size={8} className="mr-0.5" /> QR</Badge>}
                  <Badge tone="success" className="text-[10px]"><Lock size={8} className="mr-0.5" /> Auth</Badge>
                  <Badge tone="success" className="text-[10px]"><Shield size={8} className="mr-0.5" /> Time</Badge>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Main Content: Filters + Table + Security Panel ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left: Filters + Data Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters Bar */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-ink-faint">Employee</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <Input
                      placeholder="Search employee..."
                      value={filterEmployee}
                      onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="w-[150px]">
                  <label className="mb-1 block text-xs font-medium text-ink-faint">Department</label>
                  <Select value={filterDepartment || 'all'} onValueChange={(v) => { setFilterDepartment(v === 'all' ? '' : v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[150px]">
                  <label className="mb-1 block text-xs font-medium text-ink-faint">From</label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-[150px]">
                  <label className="mb-1 block text-xs font-medium text-ink-faint">To</label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-[130px]">
                  <label className="mb-1 block text-xs font-medium text-ink-faint">Status</label>
                  <div className="flex gap-1">
                    <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setPage(1); }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="PRESENT">Present</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                        <SelectItem value="LATE">Late</SelectItem>
                        <SelectItem value="HALF_DAY">Half Day</SelectItem>
                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-xs"
                  title="Reset filters"
                >
                  <FilterX size={14} className="mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock size={14} className="text-ink-soft" />
                  Attendance Records
                  {allRecords && (
                    <span className="text-xs font-normal text-ink-faint">
                      ({allRecords.meta.total} record{allRecords.meta.total !== 1 ? 's' : ''})
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => invalidate()}
                    className="h-8 text-xs"
                    title="Refresh"
                  >
                    <RefreshCw size={12} className="mr-1" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setManualForm(EMPTY_MANUAL_FORM); setManualOpen(true); }}
                  >
                    <Plus size={12} className="mr-1" />
                    Manual Entry
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {listLoading ? (
                <div className="space-y-3 p-5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="skeleton h-5 flex-1" />
                      <div className="skeleton h-5 w-20" />
                      <div className="skeleton h-5 w-16" />
                      <div className="skeleton h-5 w-16" />
                      <div className="skeleton h-5 w-20" />
                    </div>
                  ))}
                </div>
              ) : listError ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <AlertTriangle size={24} className="text-danger" />
                  <p className="text-sm text-danger">Failed to load attendance records.</p>
                  <p className="text-xs text-ink-faint">{(listErr as any)?.response?.data?.message || 'Please try again.'}</p>
                  <Button variant="secondary" size="sm" onClick={() => invalidate()} className="mt-2">
                    <RefreshCw size={12} className="mr-1" /> Retry
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="w-[72px] text-right">In</TableHead>
                        <TableHead className="w-[72px] text-right">Out</TableHead>
                        <TableHead className="w-[72px] text-right">Worked</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                        <TableHead className="w-[60px]">Src</TableHead>
                        <TableHead className="w-[72px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRecords && allRecords.items.length > 0 ? (
                        allRecords.items.map((record) => (
                          <TableRow key={record.id} className="table-row-hover">
                            <TableCell className="text-sm font-medium text-ink">
                              {formatDate(record.date)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                                  {record.employee
                                    ? `${record.employee.firstName[0]}${record.employee.lastName[0]}`
                                    : '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-ink">
                                    {record.employee
                                      ? `${record.employee.firstName} ${record.employee.lastName}`
                                      : 'Unknown'}
                                  </p>
                                  {record.employee?.employeeCode && (
                                    <p className="text-[10px] text-ink-faint">{record.employee.employeeCode}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-ink-soft">
                              {formatTime(record.checkIn)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-ink-soft">
                              {formatTime(record.checkOut)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-medium text-ink">
                              {formatDuration(record.workedMinutes)}
                            </TableCell>
                            <TableCell>
                              <Badge tone={statusTone(record.status)} className="text-[10px]">
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                                {record.checkInLat != null && <MapPin size={8} />}
                                {record.source}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEdit(record)}
                                  className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent"
                                  title="Edit record"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => confirmDelete(record.id)}
                                  className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                                  title="Delete record"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <CalendarDays size={24} className="text-ink-faint" />
                              <p className="text-sm text-ink-faint">No attendance records found.</p>
                              <p className="text-xs text-ink-faint">Try adjusting your filters or create a manual entry.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {allRecords && allRecords.meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <p className="text-xs text-ink-faint">
                    Page {allRecords.meta.page} of {allRecords.meta.totalPages}
                    <span className="ml-1">({allRecords.meta.total} total)</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(allRecords.meta.totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, allRecords.meta.totalPages - 4));
                      const p = start + i;
                      if (p > allRecords.meta.totalPages) return null;
                      return (
                        <Button
                          key={p}
                          variant={p === page ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setPage(p)}
                          className="h-8 min-w-[32px] text-xs"
                        >
                          {p}
                        </Button>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= allRecords.meta.totalPages}
                      onClick={() => setPage((p) => Math.min(allRecords.meta.totalPages, p + 1))}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security Panel */}
        <div className="space-y-4">
          {/* Security Panel Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => setSecurityExpanded(!securityExpanded)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-ink-soft" />
                  <CardTitle className="text-sm">Security</CardTitle>
                </div>
                {securityExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </CardHeader>
            {securityExpanded && (
              <CardContent className="space-y-2 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <SecurityButton
                    label="Show QR"
                    icon={QrCode}
                    active={securityTab === 'qr-display'}
                    onClick={() => setSecurityTab(securityTab === 'qr-display' ? 'none' : 'qr-display')}
                  />
                  <SecurityButton
                    label="Scan QR"
                    icon={Camera}
                    active={securityTab === 'qr-scan'}
                    onClick={() => setSecurityTab(securityTab === 'qr-scan' ? 'none' : 'qr-scan')}
                  />
                  <SecurityButton
                    label="Face"
                    icon={Camera}
                    active={securityTab === 'face'}
                    onClick={() => setSecurityTab(securityTab === 'face' ? 'none' : 'face')}
                  />
                  <SecurityButton
                    label="Device"
                    icon={Smartphone}
                    active={securityTab === 'device'}
                    onClick={() => setSecurityTab(securityTab === 'device' ? 'none' : 'device')}
                  />
                </div>

                {/* Security status indicators */}
                <div className="space-y-1 border-t border-border pt-2">
                  <SecurityStatus label="Auth" icon={Lock} active={true} badgeText="Active" badgeTone="success" />
                  <SecurityStatus
                    label="Device"
                    icon={Wifi}
                    active={isDeviceRegistered}
                    badgeText={isDeviceRegistered ? 'Registered' : 'Not set up'}
                    badgeTone={isDeviceRegistered ? 'success' : 'warning'}
                  />
                  <SecurityStatus
                    label="GPS"
                    icon={Globe}
                    active={!!navigator.geolocation}
                    badgeText={navigator.geolocation ? 'Available' : 'Unavailable'}
                    badgeTone={navigator.geolocation ? 'success' : 'warning'}
                  />
                  {faceData.faceEncoding && (
                    <SecurityStatus label="Face" icon={Camera} active badgeText="Captured ✓" badgeTone="success" />
                  )}
                  {qrCode && (
                    <SecurityStatus label="QR" icon={QrCode} active badgeText="Scanned ✓" badgeTone="success" />
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Active Security Components */}
          {securityTab === 'qr-display' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <QrCode size={14} /> Your QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QRDisplay />
                <p className="mt-3 text-center text-xs text-ink-faint">
                  Show this to a terminal or supervisor to verify your identity
                </p>
              </CardContent>
            </Card>
          )}

          {securityTab === 'qr-scan' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera size={14} /> Scan QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QRScanner onScan={(code) => setQrCode(code)} disabled={clockInMut.isPending} />
                {qrCode && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
                    <CheckCircle size={14} className="text-accent" />
                    <span className="text-xs text-accent">QR code captured! Clock in to verify.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {securityTab === 'face' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera size={14} /> Face Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FaceCapture
                  onCapture={(data) => setFaceData((f) => ({ ...f, ...data }))}
                  onLivenessResult={(result) => setFaceData((f) => ({ ...f, livenessResult: result }))}
                  disabled={clockInMut.isPending}
                />
                {faceData.faceEncoding && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
                    <CheckCircle size={14} className="text-accent" />
                    <span className="text-xs text-accent">Face captured for verification</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {securityTab === 'device' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone size={14} /> Device Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDeviceRegistered ? (
                  <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2">
                    <CheckCircle size={14} className="text-accent" />
                    <span className="text-xs text-accent">
                      Device registered ({Array.isArray(devices) ? devices.length : 0} device(s))
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-ink-faint/30 p-4 text-center">
                    <Smartphone size={24} className="mx-auto mb-2 text-ink-faint" />
                    <p className="mb-3 text-xs text-ink-faint">
                      Register this browser as a trusted device
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => registerDevice.mutate()}
                      isLoading={registerDevice.isPending}
                    >
                      Register Device
                    </Button>
                  </div>
                )}
                <a href="/ess/devices" className="block text-center text-xs text-accent hover:underline">
                  Manage all devices →
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Manual Entry Dialog ─── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manual Attendance Entry</DialogTitle>
            <DialogDescription>
              Create an attendance record for an employee. All fields marked * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-soft">Employee *</label>
              <Select
                value={manualForm.employeeId || 'select'}
                onValueChange={(v) => setManualForm((f) => ({ ...f, employeeId: v === 'select' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="select" disabled>Select an employee</SelectItem>
                  {employeesForManual?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                  {(!employeesForManual || employeesForManual.length === 0) && (
                    <SelectItem value="no-employees" disabled>No employees found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Date *</label>
                <Input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Status *</label>
                <Select
                  value={manualForm.status}
                  onValueChange={(v) => setManualForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="HALF_DAY">Half Day</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Check In</label>
                <Input
                  type="datetime-local"
                  value={manualForm.checkIn}
                  onChange={(e) => setManualForm((f) => ({ ...f, checkIn: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Check Out</label>
                <Input
                  type="datetime-local"
                  value={manualForm.checkOut}
                  onChange={(e) => setManualForm((f) => ({ ...f, checkOut: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-soft">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                placeholder="Optional notes about this entry..."
                value={manualForm.notes}
                onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => createManualMut.mutate(manualForm)}
              isLoading={createManualMut.isPending}
              disabled={!manualForm.employeeId || !manualForm.date}
            >
              <Plus size={14} className="mr-1" /> Create Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Record Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>Update check-in/out times or change the status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Check In</label>
                <Input
                  type="datetime-local"
                  value={editForm.checkIn ? new Date(editForm.checkIn).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, checkIn: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">Check Out</label>
                <Input
                  type="datetime-local"
                  value={editForm.checkOut ? new Date(editForm.checkOut).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, checkOut: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-soft">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-soft">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                placeholder="Edit notes..."
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => editRecordId && updateRecordMut.mutate({ id: editRecordId, data: editForm })}
              isLoading={updateRecordMut.isPending}
            >
              <Pencil size={14} className="mr-1" /> Update Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Attendance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attendance record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg bg-danger-soft px-4 py-3">
            <AlertTriangle size={16} className="shrink-0 text-danger" />
            <p className="text-xs text-danger">
              This will permanently remove the attendance record from the system.
              Consider marking it as absent instead.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteRecordId && deleteRecordMut.mutate(deleteRecordId)}
              isLoading={deleteRecordMut.isPending}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-Components
// ──────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
}

function SummaryCard({ label, value, icon: Icon, color, bg }: SummaryCardProps) {
  return (
    <div className="bento-card card-hover">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
          <Icon size={16} className={color} />
        </div>
        <div>
          <p className="stat-label">{label}</p>
          <p className={`font-serif text-2xl font-semibold tracking-tight ${color}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SecurityButtonProps {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
}

function SecurityButton({ label, icon: Icon, active, onClick }: SecurityButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
        active
          ? 'border-accent bg-accent-soft'
          : 'border-border hover:bg-ink-soft/5'
      }`}
    >
      <Icon size={20} className={active ? 'text-accent' : 'text-ink-soft'} />
      <span className="text-[11px] font-medium text-ink">{label}</span>
    </button>
  );
}

interface SecurityStatusProps {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  badgeText: string;
  badgeTone: 'success' | 'warning';
}

function SecurityStatus({ label, icon: Icon, active, badgeText, badgeTone }: SecurityStatusProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1 text-ink-faint"><Icon size={10} /> {label}</span>
      <Badge tone={active ? badgeTone : 'default'} className="text-[10px]">{badgeText}</Badge>
    </div>
  );
}
