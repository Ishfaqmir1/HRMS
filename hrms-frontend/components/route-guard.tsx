'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ROUTE_GUARDS, type RouteGuard } from '@/config/menu.config';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional fallback UI while loading */
  fallback?: ReactNode;
}

/**
 * Finds the matching route guard config for a given pathname.
 * Uses exact match first, then prefix match.
 */
function findGuard(pathname: string): RouteGuard | undefined {
  // Exact match
  const exact = ROUTE_GUARDS.find((g) => g.exact !== false && g.path === pathname);
  if (exact) return exact;

  // Prefix match (e.g., /ess/profile matches /ess guard)
  const prefix = ROUTE_GUARDS.find((g) => {
    if (g.exact) return false;
    // Match if pathname starts with the guard's path
    return pathname === g.path || pathname.startsWith(g.path + '/');
  });
  return prefix;
}

/**
 * Client-side route guard component.
 *
 * Wraps page content and redirects if the user doesn't have the required
 * permissions, roles, or feature flags for the current route.
 *
 * Usage in layout.tsx:
 * ```tsx
 * <ProtectedRoute>
 *   {children}
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isAuthenticated, roles, permissions, featureMap, loading } = useAuth();

  // Compute authorization synchronously — no useEffect delay, no flash
  const { authorized, redirectTo } = useMemo(() => {
    if (!isLoaded || loading) return { authorized: false, redirectTo: null };
    if (!isAuthenticated) return { authorized: false, redirectTo: `/login?redirect=${encodeURIComponent(pathname)}` };

    const guard = findGuard(pathname);
    if (!guard) return { authorized: true, redirectTo: null };

    if (guard.permissions?.length) {
      const hasPermission = guard.permissions.some((p) => permissions.includes(p));
      if (!hasPermission && !roles.includes('super-admin')) return { authorized: false, redirectTo: '/dashboard' };
    }
    if (guard.roles?.length) {
      const hasRole = guard.roles.some((r) => roles.includes(r));
      if (!hasRole && !roles.includes('super-admin')) return { authorized: false, redirectTo: '/dashboard' };
    }
    if (guard.feature) {
      const enabled = featureMap[guard.feature] === true;
      if (!enabled && !roles.includes('super-admin')) return { authorized: false, redirectTo: '/dashboard' };
    }

    return { authorized: true, redirectTo: null };
  }, [isLoaded, isAuthenticated, loading, pathname, roles, permissions, featureMap]);

  // Redirect if needed (synchronous check, runs immediately)
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Show loading spinner while auth is initializing
  if (!isLoaded || loading) {
    return fallback ?? (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authorized — show spinner briefly while redirect happens
  if (!authorized) {
    return fallback ?? (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
