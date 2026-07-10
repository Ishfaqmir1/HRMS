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
    <nav className="mobile-nav-glass mx-2 mb-2 flex items-center justify-around rounded-2xl px-2 pb-2.5 pt-2">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = currentPath === href || currentPath?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'relative flex flex-col items-center gap-1 rounded-xl px-3.5 py-1.5 transition-all duration-200',
              isActive
                ? 'text-accent scale-105'
                : 'text-ink-faint active:scale-95',
            )}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.4 : 1.5}
              className="transition-all duration-200"
            />
            <span className={clsx(
              'text-[10px] font-medium transition-all duration-200',
              isActive ? 'opacity-100' : 'opacity-70',
            )}>
              {label}
            </span>
            {isActive && (
              <span className="nav-indicator" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
