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
import { api, unwrap } from '@/lib/api-client';
import { isAuthenticated, clearSession } from '@/lib/auth';

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

      // Fetch auth context (roles + permissions), profile, and feature flags in parallel
      const [authMe, profile, features] = await Promise.all([
        unwrap<{
          userId: string;
          email: string;
          companyId: string | null;
          employeeId: string | null;
          roles: string[];
          permissions: string[];
        }>(api.get('/auth/me')).catch(() => null),
        unwrap<UserProfile>(api.get('/me/profile')).catch(() => null),
        unwrap<FeatureFlag[]>(api.get('/billing/features')).catch(() => [] as FeatureFlag[]),
      ]);

      // Fallback: decode JWT payload for basic info if /auth/me fails
      const tokenPayload = authMe ?? decodeJwt();
      const roles = tokenPayload?.roles ?? [];
      const permissions = tokenPayload?.permissions ?? [];

      const featureMap: Record<string, boolean> = {};
      for (const f of features) {
        featureMap[f.code] = f.isEnabled;
      }

      setState({
        isLoaded: true,
        isAuthenticated: true,
        userId: tokenPayload?.userId ?? null,
        email: tokenPayload?.email ?? null,
        companyId: tokenPayload?.companyId ?? null,
        employeeId: tokenPayload?.employeeId ?? null,
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
