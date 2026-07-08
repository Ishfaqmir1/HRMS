'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
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
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[];
  pathname: string | null;
}

function NavSection({ title, items, pathname }: SectionProps) {
  return (
    <div className="pb-1">
      <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wider text-white/30">
        {title}
      </p>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon size={16} strokeWidth={2} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col bg-ink text-white">
      {/* Header — always visible */}
      <div className="flex-shrink-0 px-6 py-5">
        <p className="font-serif text-xl font-semibold tracking-tight">HRMS</p>
        <p className="mt-0.5 text-xs text-white/50">Personnel Records</p>
      </div>

      {/* Scrollable nav area */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3">
        <NavSection title="Employee Self-Service" items={ESS_ITEMS} pathname={pathname} />
        <div className="mx-3 border-t border-white/5" />
        <NavSection title="Management" items={NAV_ITEMS} pathname={pathname} />
        <div className="mx-3 border-t border-white/5" />
        <NavSection title="Recruitment" items={RECRUITMENT_ITEMS} pathname={pathname} />
        <div className="mx-3 border-t border-white/5" />
        <NavSection title="Payroll" items={PAYROLL_ITEMS} pathname={pathname} />
        <div className="mx-3 border-t border-white/5" />
        <NavSection title="Administration" items={ADMIN_ITEMS} pathname={pathname} />
      </nav>

      {/* Footer — always visible at bottom */}
      <div className="flex-shrink-0 border-t border-white/10 px-6 py-3 text-xs text-white/40">
        Enterprise HRMS · Phase 1–9
      </div>
    </aside>
  );
}
