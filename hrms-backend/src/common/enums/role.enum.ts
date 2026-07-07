// Mirrors prisma `SystemRole` enum — kept separate so application code does
// not need to import generated Prisma types everywhere.
export enum SystemRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_OWNER = 'COMPANY_OWNER',
  HR = 'HR',
  HR_MANAGER = 'HR_MANAGER',
  PAYROLL_MANAGER = 'PAYROLL_MANAGER',
  RECRUITER = 'RECRUITER',
  FINANCE = 'FINANCE',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  TEAM_LEAD = 'TEAM_LEAD',
  EMPLOYEE = 'EMPLOYEE',
  AUDITOR = 'AUDITOR',
  GUEST = 'GUEST',
}
