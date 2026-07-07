'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { AttendanceRecord, PaginatedResult } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';

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
function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'error'>('idle');

  const { data: today } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => unwrap<AttendanceRecord | null>(api.get('/attendance/me/today')),
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ['attendance', 'history'],
    queryFn: () => unwrap<PaginatedResult<AttendanceRecord>>(api.get('/attendance/me/history', { params: { limit: 15 } })),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const clockInMut = useMutation({
    mutationFn: (body: { lat?: number; lng?: number; source?: string }) =>
      api.post('/attendance/clock-in', body),
    onSuccess: () => { invalidate(); },
  });

  const clockOutMut = useMutation({
    mutationFn: (body: { lat?: number; lng?: number }) =>
      api.post('/attendance/clock-out', body),
    onSuccess: () => { invalidate(); },
  });

  async function handleClockIn() {
    setGpsStatus('locating');
    const coords = await getCurrentPosition();
    if (coords) {
      setGpsStatus('idle');
      clockInMut.mutate({ ...coords, source: 'GPS' });
    } else {
      // GPS unavailable or denied — proceed without location
      setGpsStatus('idle');
      clockInMut.mutate({ source: 'WEB' });
    }
  }

  async function handleClockOut() {
    setGpsStatus('locating');
    const coords = await getCurrentPosition();
    if (coords) {
      setGpsStatus('idle');
      clockOutMut.mutate(coords);
    } else {
      setGpsStatus('idle');
      clockOutMut.mutate({});
    }
  }

  const error = (clockInMut.error as any) || (clockOutMut.error as any);
  const isPending = clockInMut.isPending || clockOutMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Attendance</h1>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex gap-8 text-sm text-ink-soft">
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
                  {gpsStatus === 'locating' ? '📍 Locating…' : 'Clock out'}
                </Button>
              </div>
              {today?.checkInLat != null && today?.checkInLng != null && (
                <span className="flex items-center gap-1 text-xs text-ink-faint">
                  <MapPin size={10} />
                  GPS captured at clock-in
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error?.response?.data?.message || 'Something went wrong.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading history…</p>}
          {history && (
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
                      {r.checkInLat != null || r.checkOutLat != null ? (
                        <span className="flex items-center gap-1 text-xs text-ink-faint">
                          <MapPin size={10} /> GPS
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">{r.source}</span>
                      )}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
