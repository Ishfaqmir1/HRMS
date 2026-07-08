'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, CalendarDays, User, Briefcase, TrendingUp, ArrowRight } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { DashboardData } from '@/lib/types';
import { Badge, statusTone } from '@/components/ui/badge';

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => unwrap<DashboardData>(api.get('/me/dashboard')),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bento-card">
              <div className="skeleton mb-3 h-4 w-24" />
              <div className="skeleton h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="ledger-tab mb-6 font-serif text-2xl font-semibold text-ink">Dashboard</h1>
        <div className="bento-card border-danger/20 bg-danger/5">
          <p className="text-sm text-danger">
            Couldn&rsquo;t load your dashboard. Your account may not be linked to an employee profile yet.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { profile, attendanceToday, pendingLeaveRequests, leaveBalances, upcomingHolidays } = data;

  return (
    <div className="mx-auto max-w-6xl page-enter">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Welcome back, {profile.name}
          </p>
        </div>
        <Badge tone="default" className="hidden sm:flex">
          <Clock size={12} className="mr-1" />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Badge>
      </div>

      {/* Bento Grid */}
      <div className="stagger-enter grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Profile Summary — spans 2 cols on desktop */}
        <div className="bento-card card-hover sm:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Employee</p>
              <h2 className="font-serif text-xl font-semibold text-ink">{profile.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {profile.designation || 'No designation'}
                {profile.department ? <span className="text-ink-faint"> · {profile.department}</span> : ''}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <User size={22} className="text-accent" />
            </div>
          </div>
          {profile.shift ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent/5 px-3 py-2 text-sm">
              <Briefcase size={14} className="text-accent" />
              <span className="text-ink-soft">
                Shift: <span className="font-medium text-ink">{profile.shift.name}</span>
                <span className="text-ink-faint"> ({profile.shift.startTime}–{profile.shift.endTime})</span>
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">No shift assigned yet.</p>
          )}
        </div>

        {/* Attendance Today */}
        <div className="bento-card card-hover">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Clock size={16} className="text-accent" />
            </div>
            <p className="stat-label">Today&rsquo;s Attendance</p>
          </div>
          {attendanceToday ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Clock in</span>
                <span className="font-medium text-ink">{formatTime(attendanceToday.checkIn)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Clock out</span>
                <span className="font-medium text-ink">{formatTime(attendanceToday.checkOut)}</span>
              </div>
              <div className="pt-2">
                <Badge tone={statusTone(attendanceToday.status)}>{attendanceToday.status}</Badge>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-ink-faint">Not clocked in today</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-accent">
                <ArrowRight size={12} />
                <span>Go to Attendance to clock in</span>
              </div>
            </div>
          )}
        </div>

        {/* Pending Leaves */}
        <div className="bento-card card-hover">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/10">
              <CalendarDays size={16} className="text-amber" />
            </div>
            <p className="stat-label">Pending Leaves</p>
          </div>
          <p className="stat-value mt-3">{pendingLeaveRequests}</p>
          <p className="text-sm text-ink-faint">awaiting approval</p>
        </div>

        {/* Leave Balances — spans 2 cols */}
        <div className="bento-card card-hover sm:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <TrendingUp size={16} className="text-accent" />
            </div>
            <p className="stat-label">Leave Balances</p>
          </div>
          {leaveBalances.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">No leave balances allocated yet.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {leaveBalances.map((b) => {
                const remaining = b.allocated + b.carriedForward - b.used;
                const total = b.allocated + b.carriedForward;
                const pct = total > 0 ? (remaining / total) * 100 : 0;
                return (
                  <div key={b.id} className="rounded-lg border border-border bg-paper/50 p-3">
                    <p className="text-xs font-medium text-ink-faint">{b.leaveType.name}</p>
                    <p className="font-serif text-2xl font-semibold text-ink">
                      {remaining.toFixed(1)}
                      <span className="text-sm font-normal text-ink-faint">/{total.toFixed(1)}</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Holidays */}
        <div className="bento-card card-hover sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/10">
              <CalendarDays size={16} className="text-amber" />
            </div>
            <p className="stat-label">Upcoming Holidays</p>
          </div>
          {upcomingHolidays.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">No upcoming holidays.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {upcomingHolidays.slice(0, 4).map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-paper/50">
                  <span className="text-sm text-ink">{h.name}</span>
                  <span className="text-xs text-ink-faint">
                    {formatDate(h.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bento-card bento-card-gradient sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-white/80">Quick Actions</p>
          <div className="mt-3 space-y-2">
            <a
              href="/attendance"
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              <Clock size={14} />
              <span>Clock In / Out</span>
            </a>
            <a
              href="/leave"
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              <CalendarDays size={14} />
              <span>Request Leave</span>
            </a>
            <a
              href="/ess"
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              <User size={14} />
              <span>My Profile</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
