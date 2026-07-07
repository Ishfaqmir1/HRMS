export interface AuthUser {
  id: string;
  email: string;
  companyId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED' | 'RETIRED';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'PROBATION';
  dateOfJoining: string;
  department?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  designation?: { id: string; title: string } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  status: string;
  source: string;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  requiresApproval: boolean;
}

export interface LeaveBalance {
  id: string;
  year: number;
  allocated: number;
  used: number;
  carriedForward: number;
  leaveType: LeaveType;
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason: string | null;
  leaveType: LeaveType;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string };
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
}

export interface DashboardData {
  profile: {
    id: string;
    name: string;
    designation: string | null;
    department: string | null;
    shift: { name: string; startTime: string; endTime: string } | null;
  };
  attendanceToday: AttendanceRecord | null;
  leaveBalances: LeaveBalance[];
  pendingLeaveRequests: number;
  upcomingHolidays: Holiday[];
}

// ============================================================
// Admin — Shifts
// ============================================================

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  gracePeriodMinutes: number;
  workingDays: number[];
  isActive: boolean;
  _count?: { employees: number };
}

// ============================================================
// Admin — Company
// ============================================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  industry?: string | null;
  size?: string | null;
  timezone: string;
  locale: string;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL_EXPIRED' | 'CANCELLED';
  isActive: boolean;
  createdAt: string;
  _count?: { employees: number; users: number };
}

// ============================================================
// Admin — Roles & Permissions
// ============================================================

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
}

export interface RolePermission {
  id: string;
  permission: Permission;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  systemRole?: string | null;
  companyId?: string | null;
  rolePermissions: RolePermission[];
}

// ============================================================
// Admin — Branch
// ============================================================

export interface Branch {
  id: string;
  name: string;
  code?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geoFenceRadiusMeters?: number | null;
}
