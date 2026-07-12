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
  version?: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
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
  adjustments?: Record<string, unknown> | null;
  createdAt: string;
  previousPayslip?: Payslip | null;
}

export interface PayrollRunVersion {
  id: string;
  version: number;
  status: string;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  processedAt: string | null;
  recalcReason: string | null;
  createdAt: string;
  previousRunId: string | null;
}

export interface PayslipDiff {
  [field: string]: { from: number; to: number; diff: number };
}

export interface PayslipCompare {
  current: Payslip;
  previous: Payslip | null;
  differences: PayslipDiff | null;
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

// ============================================================
// Attendance Analytics
// ============================================================

export interface AttendanceTrendPoint {
  period: string;
  date_label: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  avgWorkedMinutes: number;
  totalOvertimeMinutes: number;
}

export interface DepartmentAttendanceSummary {
  departmentId: string | null;
  departmentName: string;
  employeeCount: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  attendanceRate: number;
}

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

// ============================================================
// Document Builder
// ============================================================

export type DocumentTemplateCategory =
  | 'OFFER_LETTER'
  | 'APPOINTMENT_LETTER'
  | 'EXPERIENCE_LETTER'
  | 'RELIEVING_LETTER'
  | 'SALARY_CERTIFICATE'
  | 'CONFIRMATION_LETTER'
  | 'PROMOTION_LETTER'
  | 'TRANSFER_LETTER'
  | 'PAYSLIP'
  | 'OTHER';

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  OFFER_LETTER: 'Offer Letter',
  APPOINTMENT_LETTER: 'Appointment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  SALARY_CERTIFICATE: 'Salary Certificate',
  CONFIRMATION_LETTER: 'Confirmation Letter',
  PROMOTION_LETTER: 'Promotion Letter',
  TRANSFER_LETTER: 'Transfer Letter',
  PAYSLIP: 'Payslip Template',
  OTHER: 'Other',
};

export const DOCUMENT_CATEGORY_COLORS: Record<DocumentTemplateCategory, string> = {
  OFFER_LETTER: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  APPOINTMENT_LETTER: 'bg-blue-100 text-blue-700 border-blue-200',
  EXPERIENCE_LETTER: 'bg-purple-100 text-purple-700 border-purple-200',
  RELIEVING_LETTER: 'bg-amber-100 text-amber-700 border-amber-200',
  SALARY_CERTIFICATE: 'bg-rose-100 text-rose-700 border-rose-200',
  CONFIRMATION_LETTER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  PROMOTION_LETTER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  TRANSFER_LETTER: 'bg-orange-100 text-orange-700 border-orange-200',
  PAYSLIP: 'bg-sky-100 text-sky-700 border-sky-200',
  OTHER: 'bg-gray-100 text-gray-700 border-gray-200',
};

export interface DocumentTemplate {
  id: string;
  name: string;
  slug: string;
  category: DocumentTemplateCategory;
  content?: string;
  description: string | null;
  variables: string[] | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  documentType: DocumentTemplateCategory;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  generatedAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  template: { id: string; name: string; category: DocumentTemplateCategory } | null;
}

/** Shorthand for the generate endpoint response */
export interface DocumentGenerationResult {
  documents: GeneratedDocument[];
  count: number;
  templateName: string;
}

/** Shorthand for the preview endpoint response */
export interface DocumentPreviewResult {
  html: string;
  variables: Record<string, string>;
  templateName?: string;
}
