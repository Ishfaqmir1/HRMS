import { PrismaClient, SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Module -> actions map used to generate the base permission set.
const MODULES: Record<string, string[]> = {
  company: ['create', 'read', 'update', 'delete'],
  branch: ['create', 'read', 'update', 'delete'],
  department: ['create', 'read', 'update', 'delete'],
  team: ['create', 'read', 'update', 'delete'],
  designation: ['create', 'read', 'update', 'delete'],
  employee: ['create', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete', 'invite'],
  role: ['create', 'read', 'update', 'delete', 'assign'],
  shift: ['create', 'read', 'update', 'delete', 'assign'],
  holiday: ['create', 'read', 'update', 'delete'],
  attendance: ['create', 'read', 'update', 'delete', 'approve'],
  leavetype: ['create', 'read', 'update', 'delete'],
  leavebalance: ['read', 'update'],
  leave: ['create', 'read', 'update', 'delete', 'approve'],
  payroll: ['create', 'read', 'update', 'delete', 'approve', 'run'],
  recruitment: ['create', 'read', 'update', 'delete'],
  audit: ['read'],
};

// Default permission grants per system role. SUPER_ADMIN and COMPANY_OWNER
// get everything; others get a sensible subset for Phase 1.
const ROLE_PERMISSIONS: Record<SystemRole, string[] | 'ALL'> = {
  SUPER_ADMIN: 'ALL',
  COMPANY_OWNER: 'ALL',
  HR: [
    'employee.create', 'employee.read', 'employee.update',
    'department.read', 'branch.read', 'designation.read',
    'leave.read', 'leave.approve', 'attendance.read',
    'shift.read', 'holiday.create', 'holiday.read', 'holiday.update',
    'leavetype.read', 'leavebalance.read', 'leavebalance.update',
  ],
  HR_MANAGER: [
    'employee.create', 'employee.read', 'employee.update', 'employee.delete',
    'department.create', 'department.read', 'department.update',
    'branch.read', 'designation.create', 'designation.read', 'designation.update',
    'leave.read', 'leave.approve', 'attendance.read', 'attendance.approve',
    'user.invite', 'role.assign',
    'shift.create', 'shift.read', 'shift.update', 'shift.delete', 'shift.assign',
    'holiday.create', 'holiday.read', 'holiday.update', 'holiday.delete',
    'leavetype.create', 'leavetype.read', 'leavetype.update', 'leavetype.delete',
    'leavebalance.read', 'leavebalance.update',
  ],
  PAYROLL_MANAGER: [
    'payroll.create', 'payroll.read', 'payroll.update', 'payroll.approve', 'payroll.run',
    'employee.read',
  ],
  RECRUITER: ['employee.read', 'employee.create'],
  FINANCE: ['payroll.read', 'payroll.approve'],
  DEPARTMENT_HEAD: [
    'employee.read', 'leave.read', 'leave.approve', 'attendance.read', 'attendance.approve',
    'shift.read', 'holiday.read', 'leavebalance.read',
  ],
  TEAM_LEAD: [
    'employee.read', 'leave.read', 'leave.approve', 'attendance.read',
    'shift.read', 'holiday.read', 'leavebalance.read',
  ],
  EMPLOYEE: [
    'leave.create', 'leave.read', 'attendance.create', 'attendance.read',
    'shift.read', 'holiday.read', 'leavebalance.read',
  ],
  AUDITOR: ['audit.read', 'employee.read', 'payroll.read', 'attendance.read', 'leave.read'],
  GUEST: [],
};

async function main() {
  console.log('Seeding permissions...');
  const allPermissionCodes: string[] = [];

  for (const [module, actions] of Object.entries(MODULES)) {
    for (const action of actions) {
      const code = `${module}.${action}`;
      allPermissionCodes.push(code);
      await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, module, action },
      });
    }
  }

  console.log('Seeding system roles (platform-wide templates, companyId = null)...');
  for (const systemRole of Object.values(SystemRole)) {
    const slug = systemRole.toLowerCase().replace(/_/g, '-');

    // Use findFirst + create/update instead of upsert because Prisma
    // does not accept null in compound-unique where clauses at runtime.
    let role = await prisma.role.findFirst({
      where: { companyId: null, slug },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          companyId: null,
          name: systemRole.replace(/_/g, ' '),
          slug,
          systemRole,
          isSystem: true,
        },
      });
    }

    const grant = ROLE_PERMISSIONS[systemRole];
    const codes = grant === 'ALL' ? allPermissionCodes : grant;

    for (const code of codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log('Seeding demo company + super admin...');
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company Pvt Ltd',
      slug: 'demo-company',
      industry: 'Technology',
      size: '11-50',
      currency: 'USD',
      timezone: 'UTC',
    },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@hrms.io';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(superAdminPassword, 10);

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { companyId: null, slug: 'super-admin' },
  });

  // Use findFirst + upsert for user because companyId_email compound unique
  // also doesn't accept null at runtime.
  let superAdminUser = await prisma.user.findFirst({
    where: { companyId: null, email: superAdminEmail },
  });

  if (!superAdminUser) {
    superAdminUser = await prisma.user.create({
      data: {
        companyId: null,
        email: superAdminEmail,
        passwordHash,
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdminUser.id, roleId: superAdminRole.id },
  });

  console.log('Seeding billing plans (per-employee pricing)...');
  const billingPlans = [
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Best for small businesses. Core HR with attendance, leave, and ESS.',
      minMonthlyFee: 2999,
      pricePerEmployee: 0,
      includedEmployees: 25,
      maxEmployees: 25,
      maxStorageGB: 5,
      annualDiscountPercent: 15,
      features: [
        'Employee Management',
        'Attendance Tracking',
        'Leave Management',
        'Holiday Calendar',
        'Departments & Branches',
        'Employee Self-Service (ESS)',
        'Mobile Attendance',
        'Basic Reports',
        'Email Support',
      ],
      sortOrder: 1,
    },
    {
      name: 'Growth',
      slug: 'growth',
      description: 'For growing companies. Everything in Starter plus Payroll, Assets, and more.',
      minMonthlyFee: 0, // No flat fee — pay per employee
      pricePerEmployee: 120,
      includedEmployees: 0,
      maxEmployees: 100,
      maxStorageGB: 25,
      annualDiscountPercent: 15,
      features: [
        'Everything in Starter',
        'Payroll Processing',
        'Payslips & Salary Structures',
        'Employee Loans',
        'Expense Management',
        'Document Management',
        'Asset Management',
        'Shift Management',
        'Overtime Tracking',
        'Geo-fencing',
        'Workflow Approvals',
        'API Access',
        'Priority Support',
      ],
      sortOrder: 2,
    },
    {
      name: 'Business',
      slug: 'business',
      description: 'For larger teams. Full feature set with custom branding and advanced analytics.',
      minMonthlyFee: 0,
      pricePerEmployee: 99,
      includedEmployees: 0,
      maxEmployees: 500,
      maxStorageGB: 100,
      annualDiscountPercent: 18,
      features: [
        'Everything in Growth',
        'Face Attendance (optional)',
        'Custom Branding / White-label',
        'Advanced Analytics & Reports',
        'Multi-company Support',
        'SSO (Microsoft/Google/SAML)',
        'Custom Workflows',
        'Advanced Payroll Rules',
        'Audit Reports',
        'Dedicated Support',
      ],
      sortOrder: 3,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations needing custom solutions with dedicated support.',
      minMonthlyFee: 0,
      pricePerEmployee: 79,
      includedEmployees: 0,
      maxEmployees: 999999,
      maxStorageGB: 500,
      annualDiscountPercent: 20,
      features: [
        'Everything in Business',
        'Unlimited Employees',
        'On-premise Deployment Option',
        'Custom Integrations',
        'Dedicated Account Manager',
        'SLA Guarantee',
        'Advanced Security Features',
        'Custom Development Hours',
        '24/7 Phone & Email Support',
      ],
      sortOrder: 4,
    },
  ];

  for (const plan of billingPlans) {
    await prisma.billingPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log('Seeding feature flags...');
  const featureFlags = [
    { code: 'custom_branding', name: 'Custom Branding', description: 'Customize the platform with your company logo and colors', isGlobal: false },
    { code: 'advanced_payroll', name: 'Advanced Payroll', description: 'Full payroll processing with tax calculations', isGlobal: false },
    { code: 'recruitment_ats', name: 'Recruitment ATS', description: 'Applicant tracking system for hiring', isGlobal: false },
    { code: 'api_access', name: 'API Access', description: 'REST API access for custom integrations', isGlobal: false },
    { code: 'audit_logs', name: 'Audit Logs', description: 'Detailed audit trail of all system actions', isGlobal: true },
    { code: 'reports_export', name: 'Reports Export', description: 'Export reports to CSV, PDF, and Excel', isGlobal: false },
    { code: 'bulk_operations', name: 'Bulk Operations', description: 'Perform bulk create/update operations', isGlobal: false },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { code: flag.code },
      update: flag,
      create: flag,
    });
  }

  // Assign the demo company to Starter plan and set trial
  await prisma.company.update({
    where: { slug: 'demo-company' },
    data: {
      subscriptionPlan: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seeding demo HR user + employee for tenant testing...');
  const demoHrEmail = 'hr@demo.com';
  const demoHrPassword = 'Demo123!';
  const demoHrHash = await bcrypt.hash(demoHrPassword, 10);

  const hrRole = await prisma.role.findFirstOrThrow({
    where: { companyId: null, slug: 'hr-manager' },
  });

  let demoHrUser = await prisma.user.findFirst({
    where: { companyId: demoCompany.id, email: demoHrEmail },
  });

  if (!demoHrUser) {
    demoHrUser = await prisma.user.create({
      data: {
        companyId: demoCompany.id,
        email: demoHrEmail,
        passwordHash: demoHrHash,
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    });

    await prisma.userRole.create({
      data: { userId: demoHrUser.id, roleId: hrRole.id },
    });

    await prisma.employee.create({
      data: {
        companyId: demoCompany.id,
        userId: demoHrUser.id,
        employeeCode: 'EMP-0001',
        firstName: 'Demo',
        lastName: 'HR',
        workEmail: demoHrEmail,
        dateOfJoining: new Date(),
      },
    });
  }

  console.log('---------------------------------------------');
  console.log('Seed complete.');
  console.log(`Super Admin:    ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`Demo HR:        ${demoHrEmail} / ${demoHrPassword}`);
  console.log(`Demo company:   ${demoCompany.slug}`);
  console.log('---------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
