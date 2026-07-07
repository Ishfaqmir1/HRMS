'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export default function AttendancePage() {
  const queryClient = useQueryClient();

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

  const clockIn = useMutation({
    mutationFn: () => api.post('/attendance/clock-in', { source: 'WEB' }),
    onSuccess: invalidate,
  });
  const clockOut = useMutation({
    mutationFn: () => api.post('/attendance/clock-out', {}),
    onSuccess: invalidate,
  });

  const error = (clockIn.error as any) || (clockOut.error as any);

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

            <div className="flex gap-2">
              <Button onClick={() => clockIn.mutate()} isLoading={clockIn.isPending} disabled={!!today?.checkIn}>
                Clock in
              </Button>
              <Button
                variant="secondary"
                onClick={() => clockOut.mutate()}
                isLoading={clockOut.isPending}
                disabled={!today?.checkIn || !!today?.checkOut}
              >
                Clock out
              </Button>
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
                  </tr>
                ))}
                {history.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-faint">
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
