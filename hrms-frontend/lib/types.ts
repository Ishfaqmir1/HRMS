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
  createdAt: string;
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
// Payroll — Salary Structure
// ============================================================

export interface SalaryStructure {
  id: string;
  name: string;
  description?: string | null;
  basic: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  taxPercent: number;
  pensionPercent: number;
  insuranceDeduction: number;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string; designation?: { title: string } | null } | null;
  structureId?: string | null;
  structure?: SalaryStructure | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  basic: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  taxPercent: number;
  pensionPercent: number;
  insuranceDeduction: number;
  isActive: boolean;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  processedById?: string | null;
  processedAt?: string | null;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  notes?: string | null;
  createdAt: string;
  payslips?: Payslip[];
}

export interface Payslip {
  id: string;
  employeeId: string;
  runId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string; designation?: { title: string } | null } | null;
  run?: { month: number; year: number } | null;
  basic: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  overtimePay: number;
  bonus: number;
  grossPay: number;
  taxDeduction: number;
  pensionDeduction: number;
  insuranceDeduction: number;
  loanDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Loan {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  loanType: 'PERSONAL' | 'ADVANCE' | 'EMERGENCY';
  amount: number;
  totalAmount: number;
  interestRate: number;
  repaymentMonths: number;
  monthlyInstallment: number;
  purpose?: string | null;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  approvedById?: string | null;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  repayments?: LoanRepayment[];
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  status: string;
}

export interface ReimbursementCategory {
  id: string;
  name: string;
  description?: string | null;
  maxAmount?: number | null;
  isActive: boolean;
}

export interface Reimbursement {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  categoryId: string;
  category?: ReimbursementCategory | null;
  amount: number;
  description?: string | null;
  receiptUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  approvedById?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface PayrollDashboard {
  activeStructures: number;
  activeSalaries: number;
  latestRun: PayrollRun | null;
  pendingLoans: number;
  activeLoans: number;
  pendingReimbursements: number;
  yearlyRuns: { month: number; totalGross: number; totalNet: number; totalDeductions: number; employeeCount: number }[];
  currentYear: number;
}

// ============================================================
// Recruitment / ATS
// ============================================================

export interface JobPosting {
  id: string;
  title: string;
  department?: { id: string; name: string } | null;
  departmentId?: string | null;
  location?: string | null;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'PROBATION';
  minSalary?: number | null;
  maxSalary?: number | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  openings: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ON_HOLD';
  publishedAt?: string | null;
  createdAt: string;
  _count?: { applications: number };
}

export interface JobApplication {
  id: string;
  jobPostingId: string;
  jobPosting?: { id: string; title: string } | null;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  resumeUrl?: string | null;
  coverLetter?: string | null;
  source?: string | null;
  status: 'NEW' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  notes?: string | null;
  rating?: number | null;
  createdAt: string;
  interviews?: Interview[];
}

export interface Interview {
  id: string;
  applicationId: string;
  application?: { id: string; candidateName: string; candidateEmail: string; jobPosting?: { title: string } } | null;
  interviewerIds: string[];
  title: string;
  type?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  location?: string | null;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  feedback?: string | null;
  rating?: number | null;
  createdAt: string;
}

export interface RecruitmentDashboard {
  activeJobs: number;
  totalApplications: number;
  pendingInterviews: number;
  recentApplications: JobApplication[];
  stageCounts: { status: string; _count: number }[];
}

// ============================================================
// Attendance Regularization
// ============================================================

export interface AttendanceRegularization {
  id: string;
  companyId: string;
  employeeId: string;
  date: string;
  attendanceId: string | null;
  reason: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  requestedStatus: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  attendance?: {
    id: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    source: string;
    date: string;
  } | null;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// ============================================================
// Common
// ============================================================

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
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
