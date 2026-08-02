/**
 * Centralized React Query staleTime configuration.
 *
 * Each page/feature uses these constants so cache freshness is consistent
 * across the entire app. No more guessing — every query has an explicit TTL.
 *
 * Guidelines:
 *   Dashboard, Attendance  15–30s   (fast-changing: clock-in status)
 *   Leaves, Employees       1–2min   (moderate)
 *   Payroll, Settings      5–10min   (slow-changing)
 *   Master data           10–30min   (departments, designations, branches)
 *   Analytics reports      2–5min    (aggregate queries)
 */

export const STALE_TIMES = {
  /** Dashboard — clock-in status, pending leaves, today's summary */
  DASHBOARD: 30 * 1000,
  /** Attendance — real-time clock-in/out, status changes */
  ATTENDANCE: 15 * 1000,
  /** Leave — balances, requests, approvals */
  LEAVE: 60 * 1000,
  /** Employees — list, profiles, search */
  EMPLOYEES: 2 * 60 * 1000,
  /** Payroll — runs, payslips, salaries (changes monthly) */
  PAYROLL: 5 * 60 * 1000,
  /** Settings — branding, roles, permissions (very rare changes) */
  SETTINGS: 10 * 60 * 1000,
  /** Master data — departments, designations, branches, shifts, holidays */
  MASTER_DATA: 10 * 60 * 1000,
  /** Analytics — trend reports, department summaries */
  ANALYTICS: 2 * 60 * 1000,
  /** Recruitment — jobs, applicants, interviews */
  RECRUITMENT: 60 * 1000,
  /** Documents — templates, generated docs */
  DOCUMENTS: 5 * 60 * 1000,
  /** Training — programs, enrollments */
  TRAINING: 5 * 60 * 1000,
  /** Billing — plans, invoices, feature flags */
  BILLING: 10 * 60 * 1000,
  /** Profile — employee self-service */
  PROFILE: 2 * 60 * 1000,
} as const;

/**
 * Auto-refresh intervals for pages that should stay fresh without user interaction.
 * Set to 0 to disable auto-refresh.
 */
export const REFETCH_INTERVALS = {
  DASHBOARD: 60 * 1000,       // Auto-refresh dashboard every 60s
  ATTENDANCE_TODAY: 30 * 1000, // Auto-refresh today's attendance every 30s
  NONE: 0,                     // No auto-refresh (most pages)
} as const;
