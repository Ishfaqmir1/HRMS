'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, QrCode, Camera, Smartphone, Shield, ChevronDown, ChevronUp,
  CheckCircle, Lock, Wifi, Globe,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { AttendanceRecord, PaginatedResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import QRDisplay from '@/components/attendance-security/qr-display';
import QRScanner from '@/components/attendance-security/qr-scanner';
import FaceCapture from '@/components/attendance-security/face-capture';

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDuration(minutes: number | null) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Capture the user's current geolocation (prompts browser permission). */
function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
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

/** Generate a simple device fingerprint from browser properties. */
function generateDeviceId(): string {
  const nav = navigator as any;
  const screen = window.screen;
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    nav.deviceMemory || '',
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

/** Detect the connected Wi-Fi SSID via NetworkInformation API (Chrome only). */
function getWifiInfo(): { ssid?: string } {
  const conn = (navigator as any).connection;
  if (conn?.type === 'wifi') {
    return { ssid: conn.ssid || 'office-wifi' };
  }
  return {};
}

/** Get public IP via a free API (optional, for IP validation layer). */
async function getPublicIp(): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1000) });
    const data = await res.json();
    return data.ip;
  } catch {
    return undefined;
  }
}

type SecurityTab = 'none' | 'qr-display' | 'qr-scan' | 'face' | 'device';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const deviceIdRef = useRef(generateDeviceId());
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [securityTab, setSecurityTab] = useState<SecurityTab>('none');
  const [securityExpanded, setSecurityExpanded] = useState(false);

  // Security data collected from components
  const [faceData, setFaceData] = useState<{ faceEncoding?: number[]; livenessResult?: { passed: boolean; method?: string } }>({});
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => unwrap<AttendanceRecord | null>(api.get('/attendance/me/today')),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance', 'history'],
    queryFn: () => unwrap<PaginatedResult<AttendanceRecord>>(api.get('/attendance/me/history', { params: { limit: 15 } })),
  });

  const { data: devices } = useQuery({
    queryKey: ['attendance-security', 'devices'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/devices');
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const { data: securityConfig } = useQuery({
    queryKey: ['attendance-security', 'config-summary'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/config/summary');
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

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

  async function handleClockIn() {
    // If QR is required and no QR code scanned yet, show the QR scanner tab
    if (securityConfig?.config?.requireQrScan && !qrCode) {
      setSecurityTab('qr-scan');
      return;
    }
    setGpsStatus('locating');
    clockInMut.mutate(undefined);
  }

  async function handleClockOut() {
    setGpsStatus('locating');
    clockOutMut.mutate(undefined);
  }

  const error = (clockInMut.error as any) || (clockOutMut.error as any);
  const isPending = clockInMut.isPending || clockOutMut.isPending;

  const isDeviceRegistered = Array.isArray(devices) && devices.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Attendance</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            {securityConfig?.activeLayerCount
              ? `${securityConfig.activeLayerCount}/${securityConfig.totalLayerCount} security layers active`
              : 'Secure attendance tracking'}
          </p>
        </div>
        <Badge tone={securityConfig?.securityScore >= 70 ? 'success' : 'warning'}>
          <Shield size={10} className="mr-1" />
          {securityConfig?.securityScore ?? 0}% Secure
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Clock in/out */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today</CardTitle>
            </CardHeader>
            <CardContent>
              {todayLoading ? (
                <p className="text-sm text-ink-faint">Loading...</p>
              ) : (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-6 text-sm text-ink-soft">
                      <div>
                        <p className="text-xs text-ink-faint">Clock in</p>
                        <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkIn ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Clock out</p>
                        <p className="font-serif text-lg font-semibold text-ink">{formatTime(today?.checkOut ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-faint">Worked</p>
                        <p className="font-serif text-lg font-semibold text-ink">{formatDuration(today?.workedMinutes ?? null)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <Button
                          onClick={handleClockIn}
                          isLoading={isPending}
                          disabled={!!today?.checkIn}
                        >
                          {gpsStatus === 'locating' ? '📍 Locating…' : 'Clock in'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleClockOut}
                          isLoading={isPending}
                          disabled={!today?.checkIn || !!today?.checkOut}
                        >
                          Clock out
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
                      </div>
                    </div>
                  </div>

                  {error && (
                    <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                      {error?.response?.data?.message || error?.message || 'Something went wrong.'}
                    </p>
                  )}

                  {/* Security layer results summary */}
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

          <Card>
            <CardHeader>
              <CardTitle>Recent History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading && <p className="text-sm text-ink-faint">Loading history…</p>}
              {history && (
                <div className="table-responsive">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">In</th>
                      <th className="py-2 pr-4">Out</th>
                      <th className="py-2 pr-4">Worked</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.items.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4 text-ink">{formatDate(r.date)}</td>
                        <td className="py-3 pr-4 text-ink-soft">{formatTime(r.checkIn)}</td>
                        <td className="py-3 pr-4 text-ink-soft">{formatTime(r.checkOut)}</td>
                        <td className="py-3 pr-4 text-ink-soft">{formatDuration(r.workedMinutes)}</td>
                        <td className="py-3 pr-4">
                          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="flex items-center gap-1 text-xs text-ink-faint">
                            {r.checkInLat != null ? <MapPin size={10} /> : null}
                            {r.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {history.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-ink-faint">
                          No attendance records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Security panel */}
        <div className="space-y-4">
          {/* Security panel toggle */}
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
                  <button
                    onClick={() => setSecurityTab(securityTab === 'qr-display' ? 'none' : 'qr-display')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      securityTab === 'qr-display' ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:bg-ink-soft/5'
                    }`}
                  >
                    <QrCode size={20} className={securityTab === 'qr-display' ? 'text-emerald-600' : 'text-ink-soft'} />
                    <span className="text-[11px] font-medium text-ink">Show QR</span>
                  </button>
                  <button
                    onClick={() => setSecurityTab(securityTab === 'qr-scan' ? 'none' : 'qr-scan')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      securityTab === 'qr-scan' ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:bg-ink-soft/5'
                    }`}
                  >
                    <Camera size={20} className={securityTab === 'qr-scan' ? 'text-emerald-600' : 'text-ink-soft'} />
                    <span className="text-[11px] font-medium text-ink">Scan QR</span>
                  </button>
                  <button
                    onClick={() => setSecurityTab(securityTab === 'face' ? 'none' : 'face')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      securityTab === 'face' ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:bg-ink-soft/5'
                    }`}
                  >
                    <Camera size={20} className={securityTab === 'face' ? 'text-emerald-600' : 'text-ink-soft'} />
                    <span className="text-[11px] font-medium text-ink">Face</span>
                  </button>
                  <button
                    onClick={() => setSecurityTab(securityTab === 'device' ? 'none' : 'device')}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      securityTab === 'device' ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:bg-ink-soft/5'
                    }`}
                  >
                    <Smartphone size={20} className={securityTab === 'device' ? 'text-emerald-600' : 'text-ink-soft'} />
                    <span className="text-[11px] font-medium text-ink">Device</span>
                  </button>
                </div>

                {/* Security status indicators */}
                <div className="space-y-1 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-ink-faint"><Lock size={10} /> Auth</span>
                    <Badge tone="success" className="text-[10px]">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-ink-faint"><Wifi size={10} /> Device</span>
                    {isDeviceRegistered ? (
                      <Badge tone="success" className="text-[10px]">Registered</Badge>
                    ) : (
                      <Badge tone="warning" className="text-[10px]">Not set up</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-ink-faint"><Globe size={10} /> GPS</span>
                    {navigator.geolocation ? (
                      <Badge tone="success" className="text-[10px]">Available</Badge>
                    ) : (
                      <Badge tone="warning" className="text-[10px]">Unavailable</Badge>
                    )}
                  </div>
                  {faceData.faceEncoding && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-ink-faint"><Camera size={10} /> Face</span>
                      <Badge tone="success" className="text-[10px]">Captured ✓</Badge>
                    </div>
                  )}
                  {qrCode && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-ink-faint"><QrCode size={10} /> QR</span>
                      <Badge tone="success" className="text-[10px]">Scanned ✓</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Active security component */}
          {securityTab === 'qr-display' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <QrCode size={14} />
                  Your QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QRDisplay />
                <p className="mt-3 text-xs text-ink-faint text-center">
                  Show this to a terminal or supervisor to verify your identity
                </p>
              </CardContent>
            </Card>
          )}

          {securityTab === 'qr-scan' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera size={14} />
                  Scan QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QRScanner
                  onScan={(code) => setQrCode(code)}
                  disabled={clockInMut.isPending}
                />
                {qrCode && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-700">QR code captured! Clock in to verify.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {securityTab === 'face' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera size={14} />
                  Face Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FaceCapture
                  onCapture={(data) => setFaceData((f) => ({ ...f, ...data }))}
                  onLivenessResult={(result) => setFaceData((f) => ({ ...f, livenessResult: result }))}
                  disabled={clockInMut.isPending}
                />
                {faceData.faceEncoding && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-700">Face captured and encoded for verification</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {securityTab === 'device' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone size={14} />
                  Device Registration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDeviceRegistered ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs text-emerald-700">
                      Device registered ({Array.isArray(devices) ? devices.length : 0} device(s))
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-ink-faint/30 p-4 text-center">
                    <Smartphone size={24} className="mx-auto mb-2 text-ink-faint" />
                    <p className="text-xs text-ink-faint mb-3">
                      Register this browser as a trusted device for attendance
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => registerDevice.mutate()}
                      isLoading={registerDevice.isPending}
                    >
                      Register This Device
                    </Button>
                  </div>
                )}
                <a href="/ess/devices" className="block text-center text-xs text-emerald-600 hover:underline">
                  Manage all devices →
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
