'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { isAuthenticated, clearSession } from '@/lib/auth';
import type { DashboardData } from '@/lib/types';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  department: { id: string; name: string } | null;
  branch: { id: string; name: string; city: string | null } | null;
  designation: { id: string; title: string } | null;
  shift: { name: string; startTime: string; endTime: string } | null;
  reportingManager: { id: string; firstName: string; lastName: string } | null;
  team: { id: string; name: string } | null;
}

export interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  isEnabled: boolean;
}

export interface AuthState {
  /** Whether the initial auth check has completed */
  isLoaded: boolean;
  /** Whether a valid session exists */
  isAuthenticated: boolean;
  /** The authenticated user's ID (from JWT) */
  userId: string | null;
  /** The authenticated user's email */
  email: string | null;
  /** The authenticated user's company ID (null for Super Admin) */
  companyId: string | null;
  /** The linked employee ID (null for Super Admin / unlinked users) */
  employeeId: string | null;
  /** Role slugs the user has, e.g. ['hr-manager'] */
  roles: string[];
  /** Flat list of permission codes, e.g. ['employee.create', 'payroll.read'] */
  permissions: string[];
  /** User profile data from /me/profile */
  profile: UserProfile | null;
  /** Company feature flags from /billing/features */
  featureFlags: FeatureFlag[];
  /** Convenient map: feature flag code → boolean */
  featureMap: Record<string, boolean>;
  /** Loading state for the initial fetch */
  loading: boolean;
  /** Any error from fetching */
  error: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({
  isLoaded: false,
  isAuthenticated: false,
  userId: null,
  email: null,
  companyId: null,
  employeeId: null,
  roles: [],
  permissions: [],
  profile: null,
  featureFlags: [],
  featureMap: {},
  loading: true,
  error: null,
});

const AuthActionsContext = createContext<{
  refresh: () => Promise<void>;
  signOut: () => void;
}>({
  refresh: async () => {},
  signOut: () => {},
});

// ──────────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isLoaded: false,
    isAuthenticated: false,
    userId: null,
    email: null,
    companyId: null,
    employeeId: null,
    roles: [],
    permissions: [],
    profile: null,
    featureFlags: [],
    featureMap: {},
    loading: true,
    error: null,
  });

  const fetching = useRef(false);
  const queryClient = useQueryClient();

  const fetchAuth = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;

    try {
      if (!isAuthenticated()) {
        setState((s) => ({
          ...s,
          isLoaded: true,
          isAuthenticated: false,
          loading: false,
          error: null,
        }));
        return;
      }

      // Decode JWT locally — it already has roles, permissions, and employeeId.
      // Saves a full round-trip to /auth/me (~1s).
      const jwtPayload = decodeJwt();
      const roles = jwtPayload?.roles ?? [];
      const permissions = jwtPayload?.permissions ?? [];

      // Only fetch feature flags if user has company.read (skip for employees → avoids 403)
      const canReadCompany = permissions.includes('company.read');

      // Race API calls against a 10s timeout to prevent the entire auth flow
      // from hanging forever on slow backend responses.
      const TIMEOUT_MS = 10_000;
      const timeout = (ms: number) => new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Auth request timed out')), ms)
      );

      const featuresPromise = canReadCompany
        ? Promise.race([
            unwrap<FeatureFlag[]>(api.get('/billing/features')).catch(() => [] as FeatureFlag[]),
            timeout(TIMEOUT_MS).catch(() => [] as FeatureFlag[]),
          ])
        : Promise.resolve([] as FeatureFlag[]);

      // Fetch profile in parallel with features — with timeout
      const [profile, features] = await Promise.all([
        Promise.race([
          unwrap<UserProfile>(api.get('/me/profile')).catch(() => null),
          timeout(TIMEOUT_MS).catch(() => null),
        ]),
        featuresPromise,
      ]);

      const featureMap: Record<string, boolean> = {};
      for (const f of features) {
        featureMap[f.code] = f.isEnabled;
      }

      // Pre-fetch dashboard data into react-query cache during auth init
      // Saves ~1s when user lands on dashboard
      if (jwtPayload?.employeeId) {
        queryClient.prefetchQuery({
          queryKey: ['dashboard'],
          queryFn: () => unwrap<DashboardData>(api.get('/me/dashboard')),
          staleTime: 30 * 1000, // 30s — ensures fresh data but cached briefly
        });
      }

      setState({
        isLoaded: true,
        isAuthenticated: true,
        userId: jwtPayload?.userId ?? null,
        email: jwtPayload?.email ?? null,
        companyId: jwtPayload?.companyId ?? null,
        employeeId: jwtPayload?.employeeId ?? null,
        roles,
        permissions,
        profile,
        featureFlags: features,
        featureMap,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoaded: true,
        isAuthenticated: false,
        loading: false,
        error: err instanceof Error ? err.message : 'Authentication failed',
      }));
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAuth();
  }, [fetchAuth]);

  const refresh = useCallback(async () => {
    await fetchAuth();
  }, [fetchAuth]);

  const signOut = useCallback(() => {
    clearSession();
    setState({
      isLoaded: true,
      isAuthenticated: false,
      userId: null,
      email: null,
      companyId: null,
      employeeId: null,
      roles: [],
      permissions: [],
      profile: null,
      featureFlags: [],
      featureMap: {},
      loading: false,
      error: null,
    });
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={state}>
      <AuthActionsContext.Provider value={{ refresh, signOut }}>
        {children}
      </AuthActionsContext.Provider>
    </AuthContext.Provider>
  );
}

// ──────────────────────────────────────────────────────────────────
// Hooks
// ──────────────────────────────────────────────────────────────────

/** Access the full auth state */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** Access auth actions (refresh, signOut) */
export function useAuthActions() {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used within an AuthProvider');
  return ctx;
}

/**
 * Check if the current user has a specific permission.
 *
 * ```ts
 * const canViewPayroll = usePermission('payroll.read');
 * const isHr = useRole('hr-manager');
 * const payrollEnabled = useFeature('payroll');
 * ```
 */
export function usePermission(permission: string): boolean {
  const { permissions, roles } = useAuth();
  // Super Admin bypass
  if (roles.includes('super-admin') || roles.includes('company-owner')) return true;
  return permissions.includes(permission);
}

/**
 * Check if the current user has one of the specified roles.
 *
 * ```ts
 * const isHr = useRole('hr', 'hr-manager');
 * ```
 */
export function useRole(...roleSlugs: string[]): boolean {
  const { roles } = useAuth();
  if (roles.includes('super-admin') || roles.includes('company-owner')) return true;
  return roleSlugs.some((r) => roles.includes(r));
}

/**
 * Check if a specific feature flag is enabled for the current company.
 *
 * ```ts
 * const payrollEnabled = useFeature('payroll');
 * ```
 */
export function useFeature(featureCode: string): boolean {
  const { featureMap, roles } = useAuth();
  if (roles.includes('super-admin')) return true;
  return featureMap[featureCode] === true;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

interface JwtPayload {
  userId?: string;
  email?: string;
  companyId?: string | null;
  employeeId?: string | null;
  roles?: string[];
  permissions?: string[];
}

function decodeJwt(): JwtPayload | null {
  try {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('hrms_access_token')
        : null;
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return {
      userId: payload.sub ?? null,
      email: payload.email ?? null,
      companyId: payload.companyId ?? null,
      employeeId: payload.employeeId ?? null,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  } catch {
    return null;
  }
}
