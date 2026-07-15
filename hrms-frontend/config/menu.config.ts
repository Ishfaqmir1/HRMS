import {
  LayoutDashboard, Users, Clock, CalendarDays, Timer, Sun,
  MapPin, Shield, Building2, Building, DollarSign, Briefcase, BarChart3,
  Smartphone, FileText, Handshake, GraduationCap, UserCheck,
  Banknote, Receipt, Home, UserCircle, FileWarning, Upload,
  FileSpreadsheet, ScrollText, Printer, Palette, Play, CreditCard,
  type LucideIcon,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface MenuItem {
  /** Route path */
  href: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Required permission to see this item. If multiple, ANY match is sufficient. */
  permissions?: string[];
  /** Required role slug(s). If multiple, ANY match is sufficient. */
  roles?: string[];
  /** Required feature flag code. User won't see it if feature is disabled. */
  feature?: string;
  /** Sub-items (for nested menus) */
  children?: MenuItem[];
  /** If true, only visible to super-admin */
  superAdminOnly?: boolean;
  /** Show on mobile bottom nav */
  showOnMobile?: boolean;
}

export interface MenuSection {
  /** Section title displayed in the sidebar */
  title: string;
  /** Items in this section */
  items: MenuItem[];
  /** Optional: section-level permission requirement */
  permissions?: string[];
  /** Optional: section-level role requirement */
  roles?: string[];
  /** Optional: section-level feature flag requirement */
  feature?: string;
  /** Only visible to super admin */
  superAdminOnly?: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Menu Configuration
//
// Each item/section declares what permission, role, or feature flag
// is required for the user to see it. If a user doesn't have the
// required access, the item is filtered out.
// ──────────────────────────────────────────────────────────────────

export const MENU_CONFIG: MenuSection[] = [
  // ── Employee Self-Service ──────────────────────────────────
  {
    title: 'Employee Self-Service',
    items: [
      {
        href: '/ess',
        label: 'ESS Portal',
        icon: UserCircle,
        permissions: ['employee.read'],
        showOnMobile: true,
      },
      {
        href: '/ess/profile',
        label: 'My Profile',
        icon: UserCheck,
        permissions: ['employee.read'],
      },
      {
        href: '/ess/attendance',
        label: 'Attendance Calendar',
        icon: Clock,
        permissions: ['attendance.read'],
      },
      {
        href: '/ess/attendance/regularization',
        label: 'Regularization',
        icon: FileWarning,
        permissions: ['attendance.create'],
      },
      {
        href: '/ess/leave',
        label: 'Leave History',
        icon: CalendarDays,
        permissions: ['leave.read'],
      },
      {
        href: '/ess/payslips',
        label: 'Payslips',
        icon: Receipt,
        permissions: ['payroll.read'],
        feature: 'payroll',
      },
      {
        href: '/ess/tax-declarations',
        label: 'Tax Declarations',
        icon: FileWarning,
        permissions: ['employee.read'],
        feature: 'payroll',
      },
      {
        href: '/ess/expenses',
        label: 'Expense Claims',
        icon: DollarSign,
        permissions: ['payroll.create'],
        feature: 'payroll',
      },
      {
        href: '/ess/documents',
        label: 'Documents',
        icon: FileText,
        permissions: ['employee.read'],
      },
      {
        href: '/ess/assets',
        label: 'Assets',
        icon: Briefcase,
        permissions: ['employee.read'],
        feature: 'assets',
      },
      {
        href: '/ess/training',
        label: 'Training',
        icon: GraduationCap,
        permissions: ['employee.read'],
        feature: 'training',
      },
      {
        href: '/ess/devices',
        label: 'My Devices',
        icon: Smartphone,
        permissions: ['attendance.read'],
      },
    ],
  },

  // ── Platform (Super Admin) ─────────────────────────────────
  {
    title: 'Platform',
    superAdminOnly: true,
    items: [
      {
        href: '/admin/dashboard',
        label: 'Platform Dashboard',
        icon: LayoutDashboard,
        showOnMobile: true,
      },
      {
        href: '/companies',
        label: 'All Companies',
        icon: Home,
      },
      {
        href: '/billing',
        label: 'Billing',
        icon: DollarSign,
      },
      {
        href: '/admin/billing/plans',
        label: 'Plan Management',
        icon: CreditCard,
      },
      {
        href: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
      },
    ],
  },

  // ── Management ─────────────────────────────────────────────
  {
    title: 'Management',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permissions: ['employee.read'],
        showOnMobile: true,
      },
      {
        href: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
        permissions: ['employee.read'],
      },
      {
        href: '/employees',
        label: 'Employees',
        icon: Users,
        permissions: ['employee.read'],
        roles: ['hr-manager', 'hr', 'department-head', 'company-owner'],
        showOnMobile: true,
      },
      {
        href: '/employees/import',
        label: 'Bulk Import',
        icon: Upload,
        permissions: ['employee.create'],
      },
      {
        href: '/attendance',
        label: 'Attendance',
        icon: Clock,
        permissions: ['attendance.read'],
        roles: ['hr-manager', 'hr', 'department-head', 'company-owner'],
        showOnMobile: true,
      },
      {
        href: '/attendance/regularization',
        label: 'Regularization',
        icon: FileWarning,
        permissions: ['attendance.approve'],
      },
      {
        href: '/leave',
        label: 'Leave',
        icon: CalendarDays,
        permissions: ['leave.read'],
        roles: ['hr-manager', 'hr', 'department-head', 'company-owner'],
        showOnMobile: true,
      },
    ],
  },

  // ── Recruitment / ATS ──────────────────────────────────────
  {
    title: 'Recruitment',
    feature: 'recruitment',
    items: [
      {
        href: '/recruitment',
        label: 'Dashboard',
        icon: Briefcase,
        permissions: ['recruitment.read'],
      },
      {
        href: '/recruitment/jobs',
        label: 'Job Postings',
        icon: Briefcase,
        permissions: ['recruitment.read'],
      },
      {
        href: '/recruitment/applicants',
        label: 'Applicants',
        icon: Users,
        permissions: ['recruitment.read'],
      },
      {
        href: '/recruitment/interviews',
        label: 'Interviews',
        icon: Handshake,
        permissions: ['recruitment.read'],
      },
    ],
  },

  // ── Documents & Letters ────────────────────────────────────
  {
    title: 'Documents',
    items: [
      {
        href: '/documents',
        label: 'Document Builder',
        icon: FileSpreadsheet,
        permissions: ['documents.read'],
      },
      {
        href: '/documents/templates',
        label: 'Templates',
        icon: ScrollText,
        permissions: ['documents.read'],
      },
      {
        href: '/documents/generate',
        label: 'Generate Documents',
        icon: Printer,
        permissions: ['documents.create'],
      },
      {
        href: '/documents/generated',
        label: 'Generated Documents',
        icon: FileText,
        permissions: ['documents.read'],
      },
    ],
  },

  // ── Payroll ────────────────────────────────────────────────
  {
    title: 'Payroll',
    feature: 'payroll',
    items: [
      {
        href: '/payroll',
        label: 'Dashboard',
        icon: Banknote,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/runs',
        label: 'Payroll Runs',
        icon: Play,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/salary-structures',
        label: 'Salary Structures',
        icon: Building2,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/employee-salaries',
        label: 'Employee Salaries',
        icon: Users,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/payslips',
        label: 'Payslips',
        icon: Receipt,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/loans',
        label: 'Loans',
        icon: DollarSign,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/reimbursements',
        label: 'Reimbursements',
        icon: DollarSign,
        permissions: ['payroll.read'],
      },
      {
        href: '/payroll/reimbursement-categories',
        label: 'Reimbursement Categories',
        icon: Receipt,
        permissions: ['payroll.read'],
      },
    ],
  },

  // ── Administration ─────────────────────────────────────────
  {
    title: 'Administration',
    items: [
      {
        href: '/billing',
        label: 'Billing',
        icon: DollarSign,
        permissions: ['company.read'],
      },
      {
        href: '/attendance/policies',
        label: 'Attendance Policies',
        icon: Shield,
        permissions: ['company.update'],
      },
      {
        href: '/attendance/security',
        label: 'Attendance Security',
        icon: Shield,
        permissions: ['company.update'],
      },
      {
        href: '/departments',
        label: 'Departments',
        icon: Building,
        permissions: ['department.read'],
      },
      {
        href: '/designations',
        label: 'Designations',
        icon: UserCheck,
        permissions: ['employee.read'],
        roles: ['hr-manager', 'company-owner'],
      },
      {
        href: '/training',
        label: 'Training Programs',
        icon: GraduationCap,
        permissions: ['company.update'],
        feature: 'training',
      },
      {
        href: '/shifts',
        label: 'Shifts',
        icon: Timer,
        permissions: ['shift.read'],
        roles: ['hr-manager', 'company-owner'],
      },
      {
        href: '/holidays',
        label: 'Holidays',
        icon: Sun,
        permissions: ['holiday.read'],
        roles: ['hr-manager', 'company-owner'],
      },
      {
        href: '/branches',
        label: 'Branches & Geo-Fencing',
        icon: MapPin,
        permissions: ['branch.read'],
      },
          {
        href: '/settings/branding',
        label: 'Branding Settings',
        icon: Palette,
        permissions: ['company.update'],
      },
      {
        href: '/roles',
        label: 'Roles & Permissions',
        icon: Shield,
        roles: ['super-admin', 'company-owner', 'hr-manager'],
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// Mobile Bottom Nav Items (subset, filtered by permissions)
// ──────────────────────────────────────────────────────────────────

export const MOBILE_BOTTOM_ITEMS: MenuItem[] = MENU_CONFIG.flatMap(
  (section) => section.items.filter((item) => item.showOnMobile),
);

// ──────────────────────────────────────────────────────────────────
// Route Permission Map (for route guards)
// ──────────────────────────────────────────────────────────────────

export interface RouteGuard {
  path: string;
  /** Required permissions (ANY match) — empty = no permission check */
  permissions?: string[];
  /** Required roles (ANY match) — empty = no role check */
  roles?: string[];
  /** Required feature flag */
  feature?: string;
  /** Redirect URL if unauthorized (default /login) */
  redirect?: string;
  /** Exact match or prefix match */
  exact?: boolean;
}

/**
 * Route protection configuration.
 * Each route declares what's required to access it.
 */
export const ROUTE_GUARDS: RouteGuard[] = [
  // Public routes — no auth needed
  { path: '/login', permissions: [], redirect: '/dashboard' },
  { path: '/register', permissions: [], redirect: '/dashboard' },

  // Super Admin only
  { path: '/admin/dashboard', roles: ['super-admin'], exact: true },
  { path: '/companies', roles: ['super-admin'], exact: true },
  { path: '/companies/', roles: ['super-admin'] },

  // Management routes
  { path: '/dashboard', permissions: ['employee.read'] },
  { path: '/analytics', permissions: ['employee.read'] },
  { path: '/employees', permissions: ['employee.read'], roles: ['hr-manager', 'hr', 'department-head', 'company-owner'] },
  { path: '/attendance', permissions: ['attendance.read'], roles: ['hr-manager', 'hr', 'department-head', 'company-owner'] },
  { path: '/attendance/regularization', permissions: ['attendance.approve'] },
  { path: '/attendance/security', permissions: ['company.update'] },
  { path: '/attendance/policies', permissions: ['company.update'] },
  { path: '/leave', permissions: ['leave.read'], roles: ['hr-manager', 'hr', 'department-head', 'company-owner'] },

  // ESS routes
  { path: '/ess', permissions: ['employee.read'] },

  // Recruitment
  { path: '/recruitment', permissions: ['recruitment.read'], feature: 'recruitment' },

  // Payroll
  { path: '/payroll', permissions: ['payroll.read'], feature: 'payroll' },
  { path: '/payroll/runs', permissions: ['payroll.read'], feature: 'payroll' },

  // Documents & Letters
  { path: '/documents', permissions: ['documents.read'] },

  // Admin routes
  { path: '/billing', permissions: ['company.read'] },
  { path: '/settings/branding', permissions: ['company.update'] },
  { path: '/departments', permissions: ['department.read'] },
  { path: '/designations', permissions: ['employee.read'], roles: ['hr-manager', 'company-owner'] },
  { path: '/training', permissions: ['company.update'], feature: 'training' },
  { path: '/shifts', permissions: ['shift.read'], roles: ['hr-manager', 'company-owner'] },
  { path: '/holidays', permissions: ['holiday.read'], roles: ['hr-manager', 'company-owner'] },
  { path: '/branches', permissions: ['branch.read'] },
  { path: '/roles', roles: ['super-admin', 'company-owner', 'hr-manager'] },

  // Setup wizard — accessible to any company owner after approval
  { path: '/setup-wizard', permissions: ['employee.read'], exact: true },

  // Admin billing — super admin only
  { path: '/admin/billing/plans', roles: ['super-admin'], exact: true },
];
