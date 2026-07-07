'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, Users, Clock, CalendarDays, Timer, Sun, MapPin, Shield, Building2, DollarSign } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/leave', label: 'Leave', icon: CalendarDays },
];

const PAYROLL_ITEMS = [
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/payroll/salary-structures', label: 'Salary Structures', icon: DollarSign },
  { href: '/payroll/payslips', label: 'Payslips', icon: DollarSign },
  { href: '/payroll/loans', label: 'Loans', icon: DollarSign },
  { href: '/payroll/reimbursements', label: 'Reimbursements', icon: DollarSign },
];

const ADMIN_ITEMS = [
  { href: '/shifts', label: 'Shifts', icon: Timer },
  { href: '/holidays', label: 'Holidays', icon: Sun },
  { href: '/branches', label: 'Branches', icon: MapPin },
  { href: '/roles', label: 'Roles', icon: Shield },
  { href: '/companies', label: 'Companies', icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col bg-ink text-white">
      <div className="px-6 py-6">
        <p className="font-serif text-xl font-semibold tracking-tight">HRMS</p>
        <p className="mt-0.5 text-xs text-white/50">Personnel Records</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-white/30">Payroll</p>
        </div>
        {PAYROLL_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-white/30">Administration</p>
        </div>
        {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4 text-xs text-white/40">Enterprise HRMS · Phase 1–3</div>
    </aside>
  );
}
