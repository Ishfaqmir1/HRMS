'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { DashboardData } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, statusTone } from '@/components/ui/badge';

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EssPortalPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => unwrap<DashboardData>(api.get('/me/dashboard')),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">ESS Portal</h1>

      {isLoading && <p className="text-sm text-ink-faint">Loading your portal…</p>}
      {isError && (
        <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&rsquo;t load your portal. Your account may not be linked to an employee profile.
        </p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{data.profile.name}</CardTitle>
              <span className="text-sm text-ink-faint">
                {data.profile.designation || 'No designation set'}
                {data.profile.department ? ` · ${data.profile.department}` : ''}
              </span>
            </CardHeader>
            <CardContent>
              {data.profile.shift ? (
                <p className="text-sm text-ink-soft">
                  Shift: <span className="font-medium text-ink">{data.profile.shift.name}</span>{' '}
                  ({data.profile.shift.startTime}–{data.profile.shift.endTime})
                </p>
              ) : (
                <p className="text-sm text-ink-faint">No shift assigned yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Today&rsquo;s Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {data.attendanceToday ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-ink-soft">
                      <p>In: <span className="font-medium text-ink">{formatTime(data.attendanceToday.checkIn)}</span></p>
                      <p>Out: <span className="font-medium text-ink">{formatTime(data.attendanceToday.checkOut)}</span></p>
                    </div>
                    <Badge tone={statusTone(data.attendanceToday.status)}>{data.attendanceToday.status}</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">You haven&rsquo;t clocked in today.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-soft">
                  <span className="font-serif text-2xl font-semibold text-ink">{data.pendingLeaveRequests}</span>{' '}
                  pending approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <a href="/ess/profile" className="block rounded-md bg-paper px-3 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
                  ✏️ Edit Profile
                </a>
                <a href="/ess/documents" className="block rounded-md bg-paper px-3 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
                  📄 View Documents
                </a>
                <a href="/ess/payslips" className="block rounded-md bg-paper px-3 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
                  💰 View Payslips
                </a>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Leave Balances</CardTitle>
            </CardHeader>
            <CardContent>
              {data.leaveBalances.length === 0 ? (
                <p className="text-sm text-ink-faint">No leave balances allocated yet — ask HR to set them up.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {data.leaveBalances.map((b) => (
                    <div key={b.id} className="rounded-md border border-border p-3">
                      <p className="text-xs text-ink-faint">{b.leaveType.name}</p>
                      <p className="font-serif text-xl font-semibold text-ink">
                        {(b.allocated + b.carriedForward - b.used).toFixed(1)}
                      </p>
                      <p className="text-xs text-ink-faint">of {(b.allocated + b.carriedForward).toFixed(1)} days</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              {data.upcomingHolidays.length === 0 ? (
                <p className="text-sm text-ink-faint">No upcoming holidays on the calendar.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.upcomingHolidays.map((h) => (
                    <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink">{h.name}</span>
                      <span className="text-ink-faint">
                        {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
