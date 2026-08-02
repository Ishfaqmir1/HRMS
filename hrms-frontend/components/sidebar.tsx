'use client';

import { useMemo, useCallback, memo } from 'react';
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
  // Super admin: ONLY show items explicitly tagged for super admin
  if (roles.includes('super-admin') && !item.superAdminOnly) return false;
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
  if (roles.includes('super-admin') && !section.superAdminOnly) return false;
  if (section.superAdminOnly && !roles.includes('super-admin')) return false;
  if (section.roles && !section.roles.some((r) => roles.includes(r)) && !roles.includes('super-admin')) return false;
  if (section.feature && !featureMap[section.feature] && !roles.includes('super-admin')) return false;
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
// NavSection sub-component — React.memo to prevent re-render on pathname change
// Only re-renders when its own active state actually changes.
// ──────────────────────────────────────────────────────────────────

const NavSection = memo(function NavSection({
  title,
  items,
  activePath,
  onPrefetch,
}: {
  title: string;
  items: MenuItem[];
  activePath: string | null;
  onPrefetch: (href: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pb-1">
      <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </p>
      {items.map(({ href, label, icon: Icon }) => {
        const active = activePath === href || (activePath?.startsWith(href + '/') ?? false);
        return (
          <Link
            key={href}
            href={href}
            prefetch={true}
            onMouseEnter={() => onPrefetch(href)}
            className={clsx(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              active
                ? 'bg-accent/10 text-accent font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <Icon
              size={16}
              strokeWidth={active ? 2.2 : 1.8}
              className={clsx(
                'transition-all duration-100',
                active ? 'text-accent' : 'text-gray-400 group-hover:text-gray-600',
              )}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────
// Route → pre-fetch map for hover prefetching
// When the user hovers a sidebar link we seed the react-query cache
// with the page's main data so navigation feels instant.
// Keys must exactly match each page's useQuery queryKey.
// ──────────────────────────────────────────────────────────────────

const PREFETCH_ROUTES: Record<string, { queryKey: string[]; fetcher: () => Promise<unknown> }> = {
  '/dashboard': {
    queryKey: ['dashboard'],
    fetcher: () => unwrap(api.get('/me/dashboard')),
  },
  '/ess': {
    queryKey: ['dashboard'],
    fetcher: () => unwrap(api.get('/me/dashboard')),
  },
  '/employees': {
    queryKey: ['employees'],
    fetcher: () => unwrap(api.get('/employees')),
  },
  '/attendance': {
    queryKey: ['attendance', 'today'],
    fetcher: () => unwrap(api.get('/attendance/me/today')),
  },
  '/attendance/policies': {
    queryKey: ['attendance-policy'],
    fetcher: () => unwrap(api.get('/attendance-policy')),
  },
  '/attendance/regularization': {
    queryKey: ['attendance-regularizations'],
    fetcher: () => unwrap(api.get('/attendance-regularization')),
  },
  '/attendance/security': {
    queryKey: ['attendance-security', 'config-summary'],
    fetcher: () => unwrap(api.get('/attendance-security/config/summary')),
  },
  '/leave': {
    queryKey: ['leave', 'balances'],
    fetcher: () => unwrap(api.get('/leave/balances/me')),
  },
  '/payroll': {
    queryKey: ['payroll', 'dashboard'],
    fetcher: () => unwrap(api.get('/payroll/dashboard')),
  },
  '/payroll/runs': {
    queryKey: ['payroll', 'runs'],
    fetcher: () => unwrap(api.get('/payroll/runs')),
  },
  '/payroll/payslips': {
    queryKey: ['payroll', 'payslips'],
    fetcher: () => unwrap(api.get('/payroll/payslips')),
  },
  '/payroll/salary-structures': {
    queryKey: ['payroll', 'salary-structures'],
    fetcher: () => unwrap(api.get('/payroll/salary-structures')),
  },
  '/payroll/loans': {
    queryKey: ['payroll', 'loans'],
    fetcher: () => unwrap(api.get('/payroll/loans')),
  },
  '/payroll/reimbursements': {
    queryKey: ['payroll', 'reimbursements'],
    fetcher: () => unwrap(api.get('/payroll/reimbursements')),
  },
  '/payroll/reimbursement-categories': {
    queryKey: ['payroll', 'reimbursement-categories'],
    fetcher: () => unwrap(api.get('/payroll/reimbursement-categories')),
  },
  '/recruitment': {
    queryKey: ['recruitment', 'stats'],
    fetcher: () => unwrap(api.get('/recruitment/stats')),
  },
  '/recruitment/jobs': {
    queryKey: ['recruitment', 'jobs'],
    fetcher: () => unwrap(api.get('/recruitment/jobs')),
  },
  '/recruitment/applicants': {
    queryKey: ['recruitment', 'applicants'],
    fetcher: () => unwrap(api.get('/recruitment/applicants')),
  },
  '/recruitment/interviews': {
    queryKey: ['recruitment', 'interviews'],
    fetcher: () => unwrap(api.get('/recruitment/interviews')),
  },
  '/documents': {
    queryKey: ['documents'],
    fetcher: () => unwrap(api.get('/documents')),
  },
  '/documents/templates': {
    queryKey: ['document-templates'],
    fetcher: () => unwrap(api.get('/document-templates')),
  },
  '/branches': {
    queryKey: ['branches'],
    fetcher: () => unwrap(api.get('/branches')),
  },
  '/departments': {
    queryKey: ['departments'],
    fetcher: () => unwrap(api.get('/departments')),
  },
  '/designations': {
    queryKey: ['designations'],
    fetcher: () => unwrap(api.get('/designations')),
  },
  '/holidays': {
    queryKey: ['holidays'],
    fetcher: () => unwrap(api.get('/holidays')),
  },
  '/shifts': {
    queryKey: ['shifts'],
    fetcher: () => unwrap(api.get('/shifts')),
  },
  '/training': {
    queryKey: ['training'],
    fetcher: () => unwrap(api.get('/training')),
  },
  '/ess/attendance': {
    queryKey: ['me', 'today'],
    fetcher: () => unwrap(api.get('/attendance/me/today')),
  },
  '/ess/leave': {
    queryKey: ['me', 'leave-balances'],
    fetcher: () => unwrap(api.get('/me/leave/balances')),
  },
  '/ess/payslips': {
    queryKey: ['me', 'payslips'],
    fetcher: () => unwrap(api.get('/me/payslips')),
  },
  '/ess/expenses': {
    queryKey: ['me', 'expenses'],
    fetcher: () => unwrap(api.get('/me/expenses')),
  },
  '/ess/documents': {
    queryKey: ['me', 'documents'],
    fetcher: () => unwrap(api.get('/me/documents')),
  },
  '/ess/training': {
    queryKey: ['me', 'training'],
    fetcher: () => unwrap(api.get('/me/training')),
  },
  '/ess/devices': {
    queryKey: ['me', 'devices'],
    fetcher: () => unwrap(api.get('/me/devices')),
  },
  '/ess/assets': {
    queryKey: ['me', 'assets'],
    fetcher: () => unwrap(api.get('/me/assets')),
  },
  '/analytics': {
    queryKey: ['analytics', 'dashboard'],
    fetcher: () => unwrap(api.get('/analytics/dashboard')),
  },
  '/roles': {
    queryKey: ['roles'],
    fetcher: () => unwrap(api.get('/roles')),
  },
  '/billing': {
    queryKey: ['billing', 'subscription'],
    fetcher: () => unwrap(api.get('/billing/subscription')),
  },
  '/settings/branding': {
    queryKey: ['settings', 'branding'],
    fetcher: () => unwrap(api.get('/billing/branding')),
  },
  // ─── Super Admin routes ──────────────────────────────────────
  '/admin/dashboard': {
    queryKey: ['admin', 'dashboard'],
    fetcher: () => unwrap(api.get('/admin/dashboard')),
  },
  '/companies': {
    queryKey: ['companies'],
    fetcher: () => unwrap(api.get('/companies')),
  },
  '/admin/companies/pending': {
    queryKey: ['companies-pending-approvals'],
    fetcher: () => unwrap(api.get('/companies/pending/approvals')),
  },
  '/admin/audit-logs': {
    queryKey: ['admin', 'audit-logs'],
    fetcher: () => unwrap(api.get('/admin/audit-logs')),
  },
  '/admin/analytics': {
    queryKey: ['admin', 'analytics'],
    fetcher: () => unwrap(api.get('/admin/analytics')),
  },
  '/admin/billing/overview': {
    queryKey: ['admin', 'billing-overview'],
    fetcher: () => unwrap(api.get('/admin/billing/overview')),
  },
  '/admin/billing/plans': {
    queryKey: ['admin', 'billing-plans'],
    fetcher: () => unwrap(api.get('/billing/plans')),
  },
  '/admin/users': {
    queryKey: ['admin', 'users'],
    fetcher: () => unwrap(api.get('/admin/users')),
  },
  '/admin/roles': {
    queryKey: ['admin', 'roles'],
    fetcher: () => unwrap(api.get('/admin/roles')),
  },
  '/admin/settings': {
    queryKey: ['admin', 'settings'],
    fetcher: () => unwrap(api.get('/admin/settings')),
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

      <div className="mx-4 border-t border-gray-100" />

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
                activePath={pathname}
                onPrefetch={prefetchPage}
              />
            </div>
          ))
        )}
      </nav>

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
