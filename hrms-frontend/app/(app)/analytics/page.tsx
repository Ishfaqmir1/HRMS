'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { Users, Building2, Briefcase, TrendingUp } from 'lucide-react';

const COLORS = {
  accent: '#0B6E63',
  accentLight: '#4DB6A8',
  danger: '#B42318',
  amber: '#B45309',
  inkSoft: '#3C4A5E',
  inkFaint: '#7C8A9E',
  teal: '#14A898',
  purple: '#7C3AED',
  pink: '#DB2777',
  blue: '#2563EB',
};

const CHART_COLORS = [COLORS.accent, COLORS.blue, COLORS.purple, COLORS.pink, COLORS.teal, COLORS.amber, COLORS.danger];

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

interface AnalyticsData {
  summary: { totalEmployees: number; activeEmployees: number; departmentsTotal: number; openPositions: number };
  attendanceToday: { present: number; absent: number; onLeave: number; halfDay: number; late: number };
  departmentStrength: { name: string; count: number }[];
  leaveTrend: { month: number; label: string; total: number; approved: number; pending: number; rejected: number; totalDays: number }[];
  salaryDistribution: {
    brackets: { label: string; count: number }[];
    byDepartment: { name: string; averageSalary: number; employeeCount: number }[];
    averageSalary: number;
    totalEmployees: number;
  };
  genderRatio: { male: number; female: number; other: number; undisclosed: number };
  newJoiners: { month: number; label: string; count: number }[];
  attrition: { month: number; label: string; resigned: number; terminated: number; total: number }[];
  currentYear: number;
}

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => unwrap<AnalyticsData>(api.get('/analytics/dashboard')),
  });

  const isEmpty = (v: any) => !v || (Array.isArray(v) && v.length === 0);
  const hasAttendance = data && (data.attendanceToday.present + data.attendanceToday.absent + data.attendanceToday.onLeave + data.attendanceToday.halfDay + data.attendanceToday.late > 0);
  const hasGenderData = data && (data.genderRatio.male + data.genderRatio.female + data.genderRatio.other + data.genderRatio.undisclosed > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Company Analytics</h1>

      {isLoading && <p className="text-sm text-ink-faint">Loading analytics…</p>}
      {isError && (
        <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&rsquo;t load analytics data. You may not have the required permissions.
        </p>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Users size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.totalEmployees}</p><p className="text-xs text-ink-faint">Total Employees</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><TrendingUp size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.activeEmployees}</p><p className="text-xs text-ink-faint">Active</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Building2 size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.departmentsTotal}</p><p className="text-xs text-ink-faint">Departments</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"><Briefcase size={24} /></div>
                <div><p className="font-serif text-2xl font-semibold text-ink">{data.summary.openPositions}</p><p className="text-xs text-ink-faint">Open Positions</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Present vs Absent */}
            <Card>
              <CardHeader><CardTitle>Present vs Absent — Today</CardTitle></CardHeader>
              <CardContent>
                {!hasAttendance ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No attendance records for today.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: data.attendanceToday.present },
                          { name: 'Absent', value: data.attendanceToday.absent },
                          { name: 'On Leave', value: data.attendanceToday.onLeave },
                          { name: 'Half Day', value: data.attendanceToday.halfDay },
                          { name: 'Late', value: data.attendanceToday.late },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill={COLORS.accent} />
                        <Cell fill={COLORS.danger} />
                        <Cell fill={COLORS.blue} />
                        <Cell fill={COLORS.amber} />
                        <Cell fill={COLORS.purple} />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 5. Gender Ratio */}
            <Card>
              <CardHeader><CardTitle>Gender Ratio</CardTitle></CardHeader>
              <CardContent>
                {!hasGenderData ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Male', value: data.genderRatio.male },
                          { name: 'Female', value: data.genderRatio.female },
                          { name: 'Other', value: data.genderRatio.other },
                          { name: 'Undisclosed', value: data.genderRatio.undisclosed },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill={COLORS.blue} />
                        <Cell fill={COLORS.pink} />
                        <Cell fill={COLORS.purple} />
                        <Cell fill={COLORS.inkFaint} />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 2. Department Strength */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Department Strength</CardTitle></CardHeader>
              <CardContent>
                {isEmpty(data.departmentStrength) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No departments configured.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.departmentStrength} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Employees">
                        {data.departmentStrength.map((_: any, idx: number) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 3. Leave Trend */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Leave Trend — {data.currentYear}</CardTitle></CardHeader>
              <CardContent>
                {isEmpty(data.leaveTrend) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No leave data for this year.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.leaveTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke={COLORS.inkFaint} strokeWidth={2} name="Total Requests" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="approved" stroke={COLORS.accent} strokeWidth={2} name="Approved" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="pending" stroke={COLORS.amber} strokeWidth={2} name="Pending" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="rejected" stroke={COLORS.danger} strokeWidth={2} name="Rejected" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 4. Salary Distribution — by Department */}
            <Card>
              <CardHeader><CardTitle>Avg Salary by Department</CardTitle></CardHeader>
              <CardContent>
                {isEmpty(data.salaryDistribution.byDepartment) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No salary data.</p>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-ink-soft">Company avg: <span className="font-medium text-ink">{fmt(data.salaryDistribution.averageSalary)}</span></p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.salaryDistribution.byDepartment} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkFaint }} tickFormatter={(v: any) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} width={80} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
                        <Bar dataKey="averageSalary" radius={[0, 6, 6, 0]} fill={COLORS.accent} name="Avg Salary" />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 4b. Salary Brackets */}
            <Card>
              <CardHeader><CardTitle>Salary Brackets</CardTitle></CardHeader>
              <CardContent>
                {isEmpty(data.salaryDistribution.brackets) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No salary data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.salaryDistribution.brackets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.inkSoft }} />
                      <YAxis tick={{ fontSize: 11, fill: COLORS.inkFaint }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={COLORS.teal} name="Employees" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 6. New Joiners */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>New Joiners — {data.currentYear}</CardTitle></CardHeader>
              <CardContent>
                {data.newJoiners.every(n => n.count === 0) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No joiners this year.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.newJoiners} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} name="New Joiners">
                        {data.newJoiners.map((_: any, idx: number) => (
                          <Cell key={idx} fill={data.newJoiners[idx].count > 0 ? COLORS.accent : COLORS.inkFaint + '40'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 7. Attrition */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Attrition — {data.currentYear}</CardTitle></CardHeader>
              <CardContent>
                {data.attrition.every(a => a.total === 0) ? (
                  <p className="py-8 text-center text-sm text-ink-faint">No attrition data for this year.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.attrition} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.inkFaint + '30'} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
                      <Legend />
                      <Bar dataKey="resigned" stackId="a" fill={COLORS.amber} name="Resigned" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="terminated" stackId="a" fill={COLORS.danger} name="Terminated" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
