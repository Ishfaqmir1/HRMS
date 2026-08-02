'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { MOBILE_BOTTOM_ITEMS, type MenuItem } from '@/config/menu.config';

// Filter mobile items based on user's access
function getVisibleItems(
  items: MenuItem[],
  roles: string[],
  permissions: string[],
  featureMap: Record<string, boolean>,
): MenuItem[] {
  return items.filter((item) => {
    if (item.superAdminOnly && !roles.includes('super-admin')) return false;
    if (item.roles && !item.roles.some((r) => roles.includes(r)) && !roles.includes('super-admin')) return false;
    if (item.permissions && !item.permissions.some((p) => permissions.includes(p)) && !roles.includes('super-admin')) return false;
    if (item.feature && !featureMap[item.feature] && !roles.includes('super-admin')) return false;
    return true;
  });
}

export function MobileNav({ currentPath }: { currentPath: string | null }) {
  const { roles, permissions, featureMap } = useAuth();
  const visibleItems = getVisibleItems(MOBILE_BOTTOM_ITEMS, roles, permissions, featureMap);

  if (visibleItems.length === 0) return null;

  return (
    <nav className="mobile-nav-glass mx-2 mb-2 flex items-center justify-around rounded-2xl px-2 pb-2.5 pt-2">
      {visibleItems.map(({ href, label, icon: Icon }) => {
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
