'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
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
  const [authorized, setAuthorized] = useState(false);
  const prevPathname = useRef(pathname);
  const hasBeenAuthorized = useRef(false);

  useEffect(() => {
    if (!isLoaded || loading) return;

    if (!isAuthenticated) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
      return;
    }

    // Skip re-check on route changes if already authorized (avoids spinner flash)
    if (hasBeenAuthorized.current && pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      // Quick check: if route guard exists, verify; otherwise keep authorized
      const guard = findGuard(pathname);
      if (!guard) {
        setAuthorized(true);
        return;
      }
      // Only do a full check if permissions/roles might block this route
      if (guard.permissions && guard.permissions.length > 0) {
        const hasPermission = guard.permissions.some((p) => permissions.includes(p));
        if (!hasPermission && !roles.includes('super-admin')) {
          router.replace('/dashboard');
          return;
        }
      }
      if (guard.roles && guard.roles.length > 0) {
        const hasRole = guard.roles.some((r) => roles.includes(r));
        if (!hasRole && !roles.includes('super-admin')) {
          router.replace('/dashboard');
          return;
        }
      }
      setAuthorized(true);
      return;
    }

    prevPathname.current = pathname;

    const guard = findGuard(pathname);

    // No guard config found — allow access
    if (!guard) {
      hasBeenAuthorized.current = true;
      setAuthorized(true);
      return;
    }

    // Check permissions
    if (guard.permissions && guard.permissions.length > 0) {
      const hasPermission = guard.permissions.some(
        (p) => permissions.includes(p),
      );
      if (!hasPermission && !roles.includes('super-admin')) {
        router.replace('/dashboard');
        return;
      }
    }

    // Check roles
    if (guard.roles && guard.roles.length > 0) {
      const hasRole = guard.roles.some((r) => roles.includes(r));
      if (!hasRole && !roles.includes('super-admin')) {
        router.replace('/dashboard');
        return;
      }
    }

    // Check feature flag
    if (guard.feature) {
      const enabled = featureMap[guard.feature] === true;
      if (!enabled && !roles.includes('super-admin')) {
        router.replace('/dashboard');
        return;
      }
    }

    hasBeenAuthorized.current = true;
    setAuthorized(true);
  }, [isLoaded, isAuthenticated, loading, pathname, roles, permissions, featureMap, router]);

  // Show fallback or nothing while checking (only on initial load, not route changes)
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

  // On route changes, show thin loading bar instead of flashing content
  if (!authorized && hasBeenAuthorized.current) {
    return (
      <>
        <div className="fixed left-0 right-0 top-0 z-50 h-0.5 animate-pulse bg-accent" />
        {children}
      </>
    );
  }

  if (!authorized) {
    return fallback ?? (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          <p className="text-sm text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
