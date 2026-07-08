'use client';

import Link from 'next/link';
import { LayoutDashboard, Clock, CalendarDays, Users, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/leave', label: 'Leave', icon: CalendarDays },
  { href: '/employees', label: 'Team', icon: Users },
  { href: '/ess', label: 'Profile', icon: UserCircle },
];

export function MobileNav({ currentPath }: { currentPath: string | null }) {
  return (
    <nav className="glass glass-border flex items-center justify-around rounded-t-2xl px-2 pb-2 pt-2 shadow-lg">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = currentPath === href || currentPath?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors',
              isActive ? 'text-accent' : 'text-ink-faint hover:text-ink-soft',
            )}
          >
            {isActive && <span className="nav-indicator" />}
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
