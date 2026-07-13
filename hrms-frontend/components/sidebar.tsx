'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { api, unwrap } from '@/lib/api-client';
import { MENU_CONFIG, type MenuItem, type MenuSection } from '@/config/menu.config';

// ──────────────────────────────────────────────────────────────────
// Filter helpers
// ──────────────────────────────────────────────────────────────────

function itemVisible(
  item: MenuItem,
  roles: string[],
  permissions: string[],
  featureMap: Record<string, boolean>,
): boolean {
  if (item.superAdminOnly && !roles.includes('super-admin')) return false;
  if (item.roles && !item.roles.some((r) => roles.includes(r)) && !roles.includes('super-admin')) return false;
  if (item.permissions && !item.permissions.some((p) => permissions.includes(p)) && !roles.includes('super-admin')) return false;
  if (item.feature && !featureMap[item.feature] && !roles.includes('super-admin')) return false;
  return true;
}

function sectionVisible(
  section: MenuSection,
  roles: string[],
  permissions: string[],
  featureMap: Record<string, boolean>,
): boolean {
  if (section.superAdminOnly && !roles.includes('super-admin')) return false;
  if (section.roles && !section.roles.some((r) => roles.includes(r)) && !roles.includes('super-admin')) return false;
  if (section.feature && !featureMap[section.feature] && !roles.includes('super-admin')) return false;
  // Section is visible only if at least one item is visible
  return section.items.some((item) => itemVisible(item, roles, permissions, featureMap));
}

function filterItems(
  items: MenuItem[],
  roles: string[],
  permissions: string[],
  featureMap: Record<string, boolean>,
): MenuItem[] {
  return items.filter((item) => itemVisible(item, roles, permissions, featureMap));
}

// ──────────────────────────────────────────────────────────────────
// NavSection sub-component
// ──────────────────────────────────────────────────────────────────

function NavSection({
  title,
  items,
  pathname,
  onPrefetch,
}: {
  title: string;
  items: MenuItem[];
  pathname: string | null;
  onPrefetch: (href: string) => void;
}) {
  if (items.length === 0) return null;

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
            onMouseEnter={() => onPrefetch(href)}
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

// ──────────────────────────────────────────────────────────────────
// Sidebar Component
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// Route → pre-fetch map for hover prefetching
// When the user hovers a sidebar link we seed the react-query cache
// with the page's main data so navigation feels instant.
// ──────────────────────────────────────────────────────────────────

// Prefetch page data into react-query cache on sidebar link hover.
// Keys must exactly match each page's useQuery queryKey.
const PREFETCH_ROUTES: Record<string, { queryKey: string[]; fetcher: () => Promise<unknown> }> = {
  '/dashboard': {
    queryKey: ['dashboard'],
    fetcher: () => unwrap(api.get('/me/dashboard')),
  },
  '/employees': {
    queryKey: ['employees'],
    fetcher: () => unwrap(api.get('/employees')),
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { profile, roles, permissions, featureMap, isLoaded } = useAuth();

  // Memoize filtered sections to avoid re-computation on every render
  const visibleSections = useMemo(
    () =>
      MENU_CONFIG
        .filter((section) => sectionVisible(section, roles, permissions, featureMap))
        .map((section) => ({
          ...section,
          items: filterItems(section.items, roles, permissions, featureMap),
        })),
    [roles, permissions, featureMap],
  );

  // Prefetch page data into react-query cache on link hover
  const prefetchPage = useCallback(
    (href: string) => {
      const route = PREFETCH_ROUTES[href];
      if (!route) return;
      // Skip if already cached and not stale
      const state = queryClient.getQueryState(route.queryKey);
      if (state && state.data !== undefined && state.dataUpdatedAt + 60_000 > Date.now()) return;

      queryClient.prefetchQuery({
        queryKey: route.queryKey,
        queryFn: route.fetcher,
        staleTime: 30 * 1000,
      });
    },
    [queryClient],
  );

  const initials = profile
    ? `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase()
    : 'U';
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
        {!isLoaded ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          </div>
        ) : (
          visibleSections.map((section, idx) => (
            <div key={section.title}>
              {idx > 0 && <div className="mx-3 my-1 border-t border-gray-100" />}
              <NavSection
                title={section.title}
                items={section.items}
                pathname={pathname}
                onPrefetch={prefetchPage}
              />
            </div>
          ))
        )}
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
