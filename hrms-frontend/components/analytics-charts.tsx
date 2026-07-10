'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

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

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const hasAttendance = data.attendanceToday.present + data.attendanceToday.absent + data.attendanceToday.onLeave + data.attendanceToday.halfDay + data.attendanceToday.late > 0;
  const hasGenderData = data.genderRatio.male + data.genderRatio.female + data.genderRatio.other + data.genderRatio.undisclosed > 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* 1. Present vs Absent */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Present vs Absent — Today</p>
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
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Gender Ratio */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Gender Ratio</p>
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
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2. Department Strength */}
      <div className="bento-card p-5 lg:col-span-2">
        <p className="stat-label mb-4">Department Strength</p>
        {!data.departmentStrength || data.departmentStrength.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No departments configured.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.departmentStrength} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
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
      </div>

      {/* 3. Leave Trend */}
      <div className="bento-card p-5 lg:col-span-2">
        <p className="stat-label mb-4">Leave Trend — {data.currentYear}</p>
        {!data.leaveTrend || data.leaveTrend.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No leave data for this year.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.leaveTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
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
      </div>

      {/* 4. Salary Distribution — by Department */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Avg Salary by Department</p>
        {!data.salaryDistribution?.byDepartment || data.salaryDistribution.byDepartment.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No salary data.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-soft">
              Company avg:{' '}
              <span className="font-medium text-ink">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.salaryDistribution.averageSalary)}
              </span>
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.salaryDistribution.byDepartment} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkFaint }} tickFormatter={(v: any) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
                <Bar dataKey="averageSalary" radius={[0, 6, 6, 0]} fill={COLORS.accent} name="Avg Salary" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* 4b. Salary Brackets */}
      <div className="bento-card p-5">
        <p className="stat-label mb-4">Salary Brackets</p>
        {!data.salaryDistribution?.brackets || data.salaryDistribution.brackets.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No salary data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.salaryDistribution.brackets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkFaint }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={COLORS.teal} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 6. New Joiners */}
      <div className="bento-card p-5 lg:col-span-2">
        <p className="stat-label mb-4">New Joiners — {data.currentYear}</p>
        {data.newJoiners.every((n: any) => n.count === 0) ? (
          <p className="py-8 text-center text-sm text-ink-faint">No joiners this year.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.newJoiners} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="New Joiners">
                {data.newJoiners.map((_: any, idx: number) => (
                  <Cell key={idx} fill={data.newJoiners[idx].count > 0 ? COLORS.accent : `${COLORS.inkFaint}40`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 7. Attrition */}
      <div className="bento-card p-5 lg:col-span-2">
        <p className="stat-label mb-4">Attrition — {data.currentYear}</p>
        {data.attrition.every((a: any) => a.total === 0) ? (
          <p className="py-8 text-center text-sm text-ink-faint">No attrition data for this year.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.attrition} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${COLORS.inkFaint}30`} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 12, fill: COLORS.inkFaint }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E1E5EA' }} />
              <Legend />
              <Bar dataKey="resigned" stackId="a" fill={COLORS.amber} name="Resigned" radius={[0, 0, 0, 0]} />
              <Bar dataKey="terminated" stackId="a" fill={COLORS.danger} name="Terminated" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
