'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, CalendarDays, User, Briefcase, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
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
    staleTime: 30 * 1000,        // 30s — fresh enough for clock-in status
    refetchInterval: 60 * 1000,   // Auto-refresh every minute (attendance, leaves)
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="sr-only">Dashboard</h1>
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bento-card">
              <div className="skeleton mb-3 h-4 w-24" />
              <div className="skeleton h-8 w-16" />
              <div className="skeleton mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 space-y-2">
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Dashboard</h1>
        </div>
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
    <div className="mx-auto max-w-6xl">
      {/* Welcome Banner */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent to-accent-hover p-6 text-white shadow-lg shadow-accent/20">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-white" />
              <span className="text-sm font-medium text-white">Welcome back</span>
            </div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.name}
            </h1>
            <p className="mt-1 text-sm text-white">
              {profile.designation || 'Employee'}
              {profile.department ? <span className="text-white/40"> · {profile.department}</span> : ''}
            </p>
          </div>
          <div className="hidden rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm sm:block">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-10 -top-10 z-0 h-40 w-40 rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-6 right-20 z-0 h-24 w-24 rounded-full bg-white/[0.04]" />
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shadow-inner">
              <User size={22} className="text-accent" />
            </div>
          </div>
          {profile.shift ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/[0.04] px-3.5 py-2.5 text-sm ring-1 ring-accent/10">
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <Clock size={16} className="text-accent" />
            </div>
            <p className="stat-label">Today&rsquo;s Attendance</p>
          </div>
          {attendanceToday ? (
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Clock in</span>
                <span className="font-medium text-ink">{formatTime(attendanceToday.checkIn)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Clock out</span>
                <span className="font-medium text-ink">{formatTime(attendanceToday.checkOut)}</span>
              </div>
              <div className="pt-1">
                <Badge tone={statusTone(attendanceToday.status)}>{attendanceToday.status}</Badge>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-ink-faint">Not clocked in today</p>
              <a href="/attendance" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover">
                <ArrowRight size={12} />
                Go to Attendance to clock in
              </a>
            </div>
          )}
        </div>

        {/* Pending Leaves */}
        <div className="bento-card card-hover">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/10">
              <CalendarDays size={16} className="text-amber" />
            </div>
            <p className="stat-label">Pending Leaves</p>
          </div>
          <p className="stat-value mt-4">{pendingLeaveRequests}</p>
          <p className="text-sm text-ink-faint">awaiting approval</p>
        </div>

        {/* Leave Balances — spans 2 cols */}
        <div className="bento-card card-hover sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <TrendingUp size={16} className="text-accent" />
            </div>
            <p className="stat-label">Leave Balances</p>
          </div>
          {leaveBalances.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">No leave balances allocated yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {leaveBalances.map((b) => {
                const remaining = b.allocated + b.carriedForward - b.used;
                const total = b.allocated + b.carriedForward;
                const pct = total > 0 ? (remaining / total) * 100 : 0;
                return (
                  <div key={b.id} className="rounded-xl border border-border/60 bg-paper/50 p-3.5 transition-colors hover:bg-paper/80">
                    <p className="text-xs font-medium text-ink-faint">{b.leaveType.name}</p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-ink">
                      {remaining.toFixed(1)}
                      <span className="text-sm font-normal text-ink-faint">/{total.toFixed(1)}</span>
                    </p>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-700 ease-out"
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/10">
              <CalendarDays size={16} className="text-amber" />
            </div>
            <p className="stat-label">Upcoming Holidays</p>
          </div>
          {upcomingHolidays.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">No upcoming holidays.</p>
          ) : (
            <div className="mt-4 space-y-1">
              {upcomingHolidays.slice(0, 4).map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-paper/60">
                  <span className="text-sm font-medium text-ink">{h.name}</span>
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
              className="group flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm text-white transition-all duration-200 hover:bg-white/[0.14] hover:translate-x-0.5"
            >
              <Clock size={15} className="text-white/60 transition-colors group-hover:text-white/90" />
              <span>Clock In / Out</span>
            </a>
            <a
              href="/leave"
              className="group flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm text-white transition-all duration-200 hover:bg-white/[0.14] hover:translate-x-0.5"
            >
              <CalendarDays size={15} className="text-white/60 transition-colors group-hover:text-white/90" />
              <span>Request Leave</span>
            </a>
            <a
              href="/ess"
              className="group flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm text-white transition-all duration-200 hover:bg-white/[0.14] hover:translate-x-0.5"
            >
              <User size={15} className="text-white/60 transition-colors group-hover:text-white/90" />
              <span>My Profile</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
