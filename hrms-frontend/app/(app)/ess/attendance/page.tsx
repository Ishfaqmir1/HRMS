'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, statusTone } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarData {
  year: number;
  month: number;
  records: any[];
  holidays: { date: string; name: string }[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'attendance-calendar', year, month],
    queryFn: () => unwrap<CalendarData>(api.get('/me/attendance/calendar', { params: { year, month } })),
  });

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const recordMap = new Map<string, any>();
  data?.records.forEach(r => {
    const key = new Date(r.date).getDate().toString();
    recordMap.set(key, r);
  });

  const holidayMap = new Map<string, string>();
  data?.holidays.forEach(h => {
    const key = new Date(h.date).getDate().toString();
    holidayMap.set(key, h.name);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDayStatus = (day: number) => {
    if (holidayMap.has(day.toString())) return 'holiday';
    const rec = recordMap.get(day.toString());
    if (!rec) return null;
    if (rec.status === 'PRESENT') return 'present';
    if (rec.status === 'ABSENT') return 'absent';
    if (rec.status === 'HALF_DAY') return 'half-day';
    if (rec.status === 'LATE') return 'late';
    if (rec.status === 'ON_LEAVE') return 'on-leave';
    return null;
  };

  const statusStyles: Record<string, string> = {
    present: 'bg-accent text-white',
    absent: 'bg-danger-soft text-danger',
    'half-day': 'bg-amber-soft text-amber',
    late: 'bg-amber-soft text-amber',
    'on-leave': 'bg-paper text-ink-faint',
    holiday: 'bg-accent-soft text-accent',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Attendance Calendar</h1>

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
          {isLoading && <p className="text-sm text-ink-faint">Loading calendar…</p>}
          {data && (
            <>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-ink-faint">{d}</div>
                ))}
                {cells.map((day, i) => {
                  const status = day ? getDayStatus(day) : null;
                  const holidayName = day ? holidayMap.get(day.toString()) : null;
                  const rec = day ? recordMap.get(day.toString()) : null;
                  return (
                    <div
                      key={i}
                      className={`relative flex min-h-[60px] flex-col items-center justify-center rounded-md text-sm transition-colors ${
                        day ? (status ? statusStyles[status] : 'hover:bg-paper') : ''
                      }`}
                      title={rec ? `In: ${formatTime(rec.checkIn)} · Out: ${formatTime(rec.checkOut)}` : holidayName || ''}
                    >
                      {day && (
                        <>
                          <span className={`text-sm ${status === 'present' ? 'font-medium' : ''}`}>{day}</span>
                          {rec && rec.workedMinutes != null && (
                            <span className="text-[10px] opacity-70">
                              {Math.floor(rec.workedMinutes / 60)}h {rec.workedMinutes % 60}m
                            </span>
                          )}
                          {holidayName && (
                            <span className="text-[9px] leading-tight text-center px-1 truncate max-w-full">{holidayName}</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-faint">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-accent" /> Present</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-danger-soft" /> Absent</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber-soft" /> Half Day / Late</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-accent-soft" /> Holiday</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-paper border border-border" /> Leave</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {data && data.records.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Monthly Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE'].map(st => {
                const count = data.records.filter(r => r.status === st).length;
                return (
                  <div key={st} className="rounded-md border border-border p-3 text-center">
                    <p className="font-serif text-2xl font-semibold text-ink">{count}</p>
                    <p className="text-xs text-ink-faint">{st.replace('_', ' ')}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
