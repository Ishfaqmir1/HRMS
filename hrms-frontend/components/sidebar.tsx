'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api, unwrap } from '@/lib/api-client';
import {
  LayoutDashboard, Users, Clock, CalendarDays, Timer, Sun,
  MapPin, Shield, Building2, DollarSign, Briefcase, BarChart3,
  Smartphone, FileText, Handshake, GraduationCap, UserCheck,
  Banknote, Receipt, Home, UserCircle, FileWarning,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/attendance/regularization', label: 'Regularization', icon: FileWarning },
  { href: '/leave', label: 'Leave', icon: CalendarDays },
];

const ESS_ITEMS = [
  { href: '/ess', label: 'ESS Portal', icon: UserCircle },
  { href: '/ess/profile', label: 'My Profile', icon: UserCheck },
  { href: '/ess/documents', label: 'Documents', icon: FileText },
  { href: '/ess/payslips', label: 'Payslips', icon: Receipt },
  { href: '/ess/tax-declarations', label: 'Tax Declarations', icon: FileWarning },
  { href: '/ess/attendance', label: 'Attendance Calendar', icon: Clock },
  { href: '/ess/attendance/regularization', label: 'Regularization', icon: FileWarning },
  { href: '/ess/leave', label: 'Leave History', icon: CalendarDays },
  { href: '/ess/expenses', label: 'Expense Claims', icon: DollarSign },
  { href: '/ess/devices', label: 'My Devices', icon: Smartphone },
  { href: '/ess/assets', label: 'Assets', icon: Briefcase },
  { href: '/ess/training', label: 'Training', icon: GraduationCap },
];

const RECRUITMENT_ITEMS = [
  { href: '/recruitment', label: 'Dashboard', icon: Briefcase },
  { href: '/recruitment/jobs', label: 'Job Postings', icon: Briefcase },
  { href: '/recruitment/applicants', label: 'Applicants', icon: Users },
  { href: '/recruitment/interviews', label: 'Interviews', icon: Handshake },
];

const PAYROLL_ITEMS = [
  { href: '/payroll', label: 'Dashboard', icon: Banknote },
  { href: '/payroll/salary-structures', label: 'Salary Structures', icon: Building2 },
  { href: '/payroll/employee-salaries', label: 'Employee Salaries', icon: Users },
  { href: '/payroll/payslips', label: 'Payslips', icon: Receipt },
  { href: '/payroll/loans', label: 'Loans', icon: DollarSign },
  { href: '/payroll/reimbursements', label: 'Reimbursements', icon: DollarSign },
];

const ADMIN_ITEMS = [
  { href: '/billing', label: 'Billing', icon: DollarSign },
  { href: '/attendance/security', label: 'Attendance Security', icon: Shield },
  { href: '/shifts', label: 'Shifts', icon: Timer },
  { href: '/holidays', label: 'Holidays', icon: Sun },
  { href: '/branches', label: 'Branches', icon: MapPin },
  { href: '/roles', label: 'Roles', icon: Shield },
  { href: '/companies', label: 'Companies', icon: Home },
];

interface SectionProps {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[];
  pathname: string | null;
}

function NavSection({ title, items, pathname }: SectionProps) {
  return (
    <div className="pb-1">
      <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </p>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              active
                ? 'bg-accent/10 text-accent font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            {/* Active indicator bar */}
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <Icon
              size={16}
              strokeWidth={active ? 2.2 : 1.8}
              className={clsx(
                'transition-all duration-150',
                active ? 'text-accent' : 'text-gray-400 group-hover:text-gray-600',
              )}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const { data: profile } = useQuery<{ firstName: string; lastName: string }>({
    queryKey: ['me', 'profile'],
    queryFn: () => unwrap(api.get('/me/profile')),
    retry: false,
  });

  const initials = profile ? `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase() : 'U';
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : 'User';

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white text-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <span className="text-sm font-bold text-white">H</span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight leading-none text-gray-900">HRMS</p>
            <p className="mt-0.5 text-[10px] text-gray-400">Enterprise Platform</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100" />

      {/* Scrollable nav area */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-2">
        <NavSection title="Employee Self-Service" items={ESS_ITEMS} pathname={pathname} />
        <div className="mx-3 my-1 border-t border-gray-100" />
        <NavSection title="Management" items={NAV_ITEMS} pathname={pathname} />
        <div className="mx-3 my-1 border-t border-gray-100" />
        <NavSection title="Recruitment" items={RECRUITMENT_ITEMS} pathname={pathname} />
        <div className="mx-3 my-1 border-t border-gray-100" />
        <NavSection title="Payroll" items={PAYROLL_ITEMS} pathname={pathname} />
        <div className="mx-3 my-1 border-t border-gray-100" />
        <NavSection title="Administration" items={ADMIN_ITEMS} pathname={pathname} />
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
            <span className="text-xs font-semibold text-accent">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-900">{fullName}</p>
            <p className="text-[10px] text-gray-400">HRMS · v1.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
