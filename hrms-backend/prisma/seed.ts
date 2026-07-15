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
  documents: ['create', 'read', 'update', 'delete'],
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
    'branch.create', 'branch.read', 'branch.update', 'branch.delete',
    'designation.create', 'designation.read', 'designation.update',
    'leave.create', 'leave.read', 'leave.approve', 'attendance.read', 'attendance.approve',
    'user.invite', 'role.assign',
    'shift.create', 'shift.read', 'shift.update', 'shift.delete', 'shift.assign',
    'holiday.create', 'holiday.read', 'holiday.update', 'holiday.delete',
    'leavetype.create', 'leavetype.read', 'leavetype.update', 'leavetype.delete',
    'leavebalance.read', 'leavebalance.update',
    'payroll.read', 'payroll.create',
    'recruitment.read',
    'company.update',
    'documents.read', 'documents.create',
  ],
  PAYROLL_MANAGER: [
    'payroll.create', 'payroll.read', 'payroll.update', 'payroll.approve', 'payroll.run',
    'employee.read',
  ],
  RECRUITER: ['employee.read', 'employee.create'],
  FINANCE: ['payroll.read', 'payroll.approve'],
  DEPARTMENT_HEAD: [
    'employee.read', 'employee.update',
    'leave.read', 'leave.approve', 'attendance.read', 'attendance.approve',
    'payroll.read',
    'shift.read', 'holiday.read', 'leavebalance.read',
  ],
  TEAM_LEAD: [
    'employee.read', 'employee.update',
    'leave.read', 'leave.approve', 'attendance.read',
    'payroll.read',
    'shift.read', 'holiday.read', 'leavebalance.read',
  ],
  EMPLOYEE: [
    'employee.read', 'employee.update',
    'leave.create', 'leave.read', 'attendance.create', 'attendance.read',
    'payroll.read', 'payroll.create',
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
      update: {
        ...plan,
        yearlyPrice: plan.minMonthlyFee > 0 ? plan.minMonthlyFee * 12 * (1 - (plan.annualDiscountPercent || 0) / 100) : 0,
        apiLimit: plan.slug === 'starter' ? 1000 : plan.slug === 'growth' ? 10000 : plan.slug === 'business' ? 50000 : plan.slug === 'enterprise' ? 100000 : 0,
        prioritySupport: plan.slug === 'starter' ? 'email' : plan.slug === 'growth' ? 'priority' : plan.slug === 'business' ? 'dedicated' : plan.slug === 'enterprise' ? '24/7' : 'none',
        visibility: 'PUBLIC',
      },
      create: {
        ...plan,
        yearlyPrice: plan.minMonthlyFee > 0 ? plan.minMonthlyFee * 12 * (1 - (plan.annualDiscountPercent || 0) / 100) : 0,
        apiLimit: plan.slug === 'starter' ? 1000 : plan.slug === 'growth' ? 10000 : plan.slug === 'business' ? 50000 : plan.slug === 'enterprise' ? 100000 : 0,
        prioritySupport: plan.slug === 'starter' ? 'email' : plan.slug === 'growth' ? 'priority' : plan.slug === 'business' ? 'dedicated' : plan.slug === 'enterprise' ? '24/7' : 'none',
        visibility: 'PUBLIC',
      },
    });
  }

  console.log('Seeding plan features catalog...');
  const PLAN_FEATURES = [
    // Core
    { code: 'employee_management', name: 'Employee Management', category: 'core', sortOrder: 1 },
    { code: 'department_branch', name: 'Departments & Branches', category: 'core', sortOrder: 2 },
    { code: 'designations', name: 'Designations', category: 'core', sortOrder: 3 },
    { code: 'roles_permissions', name: 'Custom Roles & Permissions', category: 'core', sortOrder: 4, description: 'Define custom roles with granular permissions' },
    { code: 'approval_workflow', name: 'Approval Workflows', category: 'core', sortOrder: 5 },

    // Attendance
    { code: 'attendance', name: 'Attendance Tracking', category: 'attendance', sortOrder: 10 },
    { code: 'shift_management', name: 'Shift Management', category: 'attendance', sortOrder: 11 },
    { code: 'roster', name: 'Roster / Scheduling', category: 'attendance', sortOrder: 12 },
    { code: 'gps_attendance', name: 'GPS Attendance', category: 'attendance', sortOrder: 13 },
    { code: 'qr_attendance', name: 'QR Attendance', category: 'attendance', sortOrder: 14 },
    { code: 'face_recognition', name: 'Face Recognition', category: 'attendance', sortOrder: 15 },
    { code: 'biometric', name: 'Biometric Integration', category: 'attendance', sortOrder: 16 },
    { code: 'geo_fence', name: 'Geo Fencing', category: 'attendance', sortOrder: 17 },
    { code: 'overtime', name: 'Overtime Tracking', category: 'attendance', sortOrder: 18 },
    { code: 'attendance_reports', name: 'Attendance Reports', category: 'attendance', sortOrder: 19 },

    // Leave
    { code: 'leave_management', name: 'Leave Management', category: 'leave', sortOrder: 20 },
    { code: 'leave_types', name: 'Custom Leave Types', category: 'leave', sortOrder: 21 },
    { code: 'leave_balance', name: 'Leave Balance Tracking', category: 'leave', sortOrder: 22 },

    // Payroll
    { code: 'payroll', name: 'Payroll Processing', category: 'payroll', sortOrder: 30 },
    { code: 'payslips', name: 'Payslips', category: 'payroll', sortOrder: 31 },
    { code: 'salary_structures', name: 'Salary Structures', category: 'payroll', sortOrder: 32 },
    { code: 'tax_calculations', name: 'Tax Calculations', category: 'payroll', sortOrder: 33 },
    { code: 'loans', name: 'Employee Loans', category: 'payroll', sortOrder: 34 },
    { code: 'expenses', name: 'Expense Management', category: 'payroll', sortOrder: 35 },
    { code: 'reimbursements', name: 'Reimbursements', category: 'payroll', sortOrder: 36 },
    { code: 'statutory_compliance', name: 'Statutory Compliance (PF/ESI/PT)', category: 'payroll', sortOrder: 37 },

    // HR
    { code: 'recruitment', name: 'Recruitment / ATS', category: 'hr', sortOrder: 40 },
    { code: 'onboarding', name: 'Employee Onboarding', category: 'hr', sortOrder: 41 },
    { code: 'documents', name: 'Document Management', category: 'hr', sortOrder: 42 },
    { code: 'document_templates', name: 'Document Templates', category: 'hr', sortOrder: 43 },
    { code: 'performance', name: 'Performance Reviews', category: 'hr', sortOrder: 44 },
    { code: 'goals', name: 'Goals & OKRs', category: 'hr', sortOrder: 45 },
    { code: 'training', name: 'Training & LMS', category: 'hr', sortOrder: 46, description: 'Learning management system with training programs' },
    { code: 'assets', name: 'Asset Management', category: 'hr', sortOrder: 47 },
    { code: 'travel', name: 'Travel Management', category: 'hr', sortOrder: 48 },

    // ESS
    { code: 'ess', name: 'Employee Self-Service (ESS)', category: 'ess', sortOrder: 50 },
    { code: 'mobile_app', name: 'Mobile App Access', category: 'ess', sortOrder: 51 },
    { code: 'whatsapp', name: 'WhatsApp Integration', category: 'ess', sortOrder: 52 },

    // Analytics & Reports
    { code: 'basic_reports', name: 'Basic Reports', category: 'analytics', sortOrder: 60 },
    { code: 'advanced_analytics', name: 'Advanced Analytics', category: 'analytics', sortOrder: 61 },
    { code: 'custom_reports', name: 'Custom Reports', category: 'analytics', sortOrder: 62 },
    { code: 'audit_logs', name: 'Audit Logs', category: 'analytics', sortOrder: 63 },
    { code: 'notifications', name: 'Notifications & Alerts', category: 'analytics', sortOrder: 64 },

    // Security
    { code: 'sso', name: 'SSO (Microsoft/Google/SAML)', category: 'security', sortOrder: 70 },
    { code: 'custom_branding', name: 'Custom Branding / White-label', category: 'security', sortOrder: 71 },
    { code: 'multi_branch', name: 'Multi-Branch Support', category: 'security', sortOrder: 72 },
    { code: 'multi_company', name: 'Multi-Company Support', category: 'security', sortOrder: 73 },
    { code: 'multi_country', name: 'Multi-Country Support', category: 'security', sortOrder: 74 },

    // Integrations & API
    { code: 'api_access', name: 'API Access', category: 'integrations', sortOrder: 80 },
    { code: 'webhooks', name: 'Webhooks', category: 'integrations', sortOrder: 81 },
    { code: 'integrations', name: 'Third-party Integrations', category: 'integrations', sortOrder: 82 },
    { code: 'ai_assistant', name: 'AI Assistant', category: 'integrations', sortOrder: 83 },
  ];

  const createdFeatures: Record<string, string> = {};
  for (const f of PLAN_FEATURES) {
    const feature = await prisma.planFeature.upsert({
      where: { code: f.code },
      update: f,
      create: f,
    });
    createdFeatures[f.code] = feature.id;
  }

  console.log('Seeding plan-feature mappings...');
  // Define which features each plan gets
  type FeatureMap = Record<string, boolean>;
  const starterFeatures: FeatureMap = {
    employee_management: true,
    department_branch: true,
    designations: true,
    attendance: true,
    shift_management: true,
    leave_management: true,
    leave_types: true,
    leave_balance: true,
    ess: true,
    mobile_app: true,
    basic_reports: true,
    notifications: true,
    onboarding: true,
    documents: true,
    whatsapp: false,
    qr_attendance: false,
    gps_attendance: false,
    face_recognition: false,
    biometric: false,
    geo_fence: false,
    overtime: false,
    performance: false,
    goals: false,
    training: false,
    assets: false,
    travel: false,
    recruitment: false,
    payroll: false,
    payslips: false,
    salary_structures: false,
    tax_calculations: false,
    loans: false,
    expenses: false,
    reimbursements: false,
    statutory_compliance: false,
    api_access: false,
    webhooks: false,
    integrations: false,
    sso: false,
    custom_branding: false,
    multi_branch: false,
    multi_company: false,
    multi_country: false,
    advanced_analytics: false,
    custom_reports: false,
    audit_logs: false,
    document_templates: false,
    roles_permissions: false,
    approval_workflow: false,
    roster: false,
    ai_assistant: false,
  };

  const growthFeatures: FeatureMap = {
    ...starterFeatures,
    payroll: true,
    payslips: true,
    salary_structures: true,
    tax_calculations: true,
    loans: true,
    expenses: true,
    reimbursements: true,
    assets: true,
    shift_management: true,
    overtime: true,
    geo_fence: true,
    gps_attendance: true,
    qr_attendance: true,
    approval_workflow: true,
    api_access: true,
    basic_reports: true,
    audit_logs: true,
    document_templates: true,
    notifications: true,
    statutory_compliance: true,
    travel: true,
    training: true,
    onboarding: true,
  };

  const businessFeatures: FeatureMap = {
    ...growthFeatures,
    face_recognition: true,
    custom_branding: true,
    advanced_analytics: true,
    custom_reports: true,
    sso: true,
    roles_permissions: true,
    multi_branch: true,
    webhooks: true,
    integrations: true,
    biometric: true,
    roster: true,
    performance: true,
    goals: true,
  };

  const enterpriseFeatures: FeatureMap = {
    ...businessFeatures,
    multi_company: true,
    multi_country: true,
    ai_assistant: true,
    whatsapp: true,
    all_features: true,
  };

  // Feature toggles for each plan (everything else defaults to false)
  // Helper to apply feature map to a plan
  async function applyFeatureMappings(planSlug: string, featureMap: FeatureMap) {
    const plan = await prisma.billingPlan.findUnique({ where: { slug: planSlug } });
    if (!plan) return;
    for (const [code, enabled] of Object.entries(featureMap)) {
      const featureId = createdFeatures[code];
      if (!featureId) continue;
      await prisma.planFeatureMapping.upsert({
        where: { planId_featureId: { planId: plan.id, featureId } },
        update: { isEnabled: enabled },
        create: { planId: plan.id, featureId, isEnabled: enabled },
      });
    }
  }

  await applyFeatureMappings('starter', starterFeatures);
  await applyFeatureMappings('growth', growthFeatures);
  await applyFeatureMappings('business', businessFeatures);
  await applyFeatureMappings('enterprise', enterpriseFeatures);

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

  // ====================================================================
  // Phase 2: Comprehensive Demo Data
  // ====================================================================
  console.log('Seeding comprehensive demo data...');

  // --- Branches ---
  const headOffice = await prisma.branch.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'HQ' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Head Office - San Francisco',
      code: 'HQ',
      addressLine1: '123 Market Street',
      city: 'San Francisco',
      state: 'California',
      country: 'USA',
      postalCode: '94105',
      timezone: 'America/Los_Angeles',
      isHeadOffice: true,
      latitude: 37.7749,
      longitude: -122.4194,
    },
  });

  const nyBranch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'NYC' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'New York Office',
      code: 'NYC',
      addressLine1: '350 Fifth Avenue',
      city: 'New York',
      state: 'New York',
      country: 'USA',
      postalCode: '10118',
      timezone: 'America/New_York',
      isHeadOffice: false,
      latitude: 40.7128,
      longitude: -74.0060,
    },
  });

  // --- Departments ---
  const engineeringDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'ENG' } },
    update: {},
    create: {
      companyId: demoCompany.id, branchId: headOffice.id,
      name: 'Engineering', code: 'ENG', isActive: true,
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'HR' } },
    update: {},
    create: {
      companyId: demoCompany.id, branchId: headOffice.id,
      name: 'Human Resources', code: 'HR', isActive: true,
    },
  });

  const salesDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'SALES' } },
    update: {},
    create: {
      companyId: demoCompany.id, branchId: nyBranch.id,
      name: 'Sales', code: 'SALES', isActive: true,
    },
  });

  const marketingDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'MRKT' } },
    update: {},
    create: {
      companyId: demoCompany.id, branchId: headOffice.id,
      name: 'Marketing', code: 'MRKT', isActive: true,
    },
  });

  // --- Designations ---
  const designations = [
    { title: 'Software Engineer', level: 1 },
    { title: 'Senior Software Engineer', level: 2 },
    { title: 'Engineering Manager', level: 3 },
    { title: 'HR Executive', level: 1 },
    { title: 'HR Manager', level: 2 },
    { title: 'Sales Representative', level: 1 },
    { title: 'Sales Manager', level: 2 },
    { title: 'Marketing Specialist', level: 1 },
    { title: 'Product Designer', level: 1 },
  ];
  const createdDesignations: Record<string, string> = {};
  for (const d of designations) {
    const found = await prisma.designation.findFirst({
      where: { companyId: demoCompany.id, title: d.title },
    });
    if (found) {
      createdDesignations[d.title] = found.id;
    } else {
      const created = await prisma.designation.create({
        data: { companyId: demoCompany.id, title: d.title, level: d.level },
      });
      createdDesignations[d.title] = created.id;
    }
  }

  // --- Shifts ---
  const generalShift = await prisma.shift.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      companyId: demoCompany.id,
      name: 'General Shift',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      workingDays: [1, 2, 3, 4, 5],
    },
  });

  const nightShift = await prisma.shift.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      companyId: demoCompany.id,
      name: 'Night Shift',
      startTime: '22:00',
      endTime: '06:00',
      breakMinutes: 45,
      gracePeriodMinutes: 10,
      workingDays: [1, 2, 3, 4, 5, 6],
    },
  });

  // --- Holidays (current year) ---
  const currentYear = new Date().getFullYear();
  const holidays = [
    { name: "New Year's Day", date: new Date(currentYear, 0, 1), isOptional: false },
    { name: 'Martin Luther King Jr. Day', date: new Date(currentYear, 0, 20), isOptional: false },
    { name: 'Memorial Day', date: new Date(currentYear, 4, 26), isOptional: false },
    { name: 'Independence Day', date: new Date(currentYear, 6, 4), isOptional: false },
    { name: 'Labor Day', date: new Date(currentYear, 8, 1), isOptional: false },
    { name: 'Thanksgiving Day', date: new Date(currentYear, 10, 27), isOptional: false },
    { name: 'Christmas Day', date: new Date(currentYear, 11, 25), isOptional: false },
    { name: 'Diwali (Optional)', date: new Date(currentYear, 9, 31), isOptional: true },
  ];
  for (const h of holidays) {
    const exists = await prisma.holiday.findFirst({
      where: { companyId: demoCompany.id, date: h.date },
    });
    if (!exists) {
      await prisma.holiday.create({
        data: { companyId: demoCompany.id, name: h.name, date: h.date, isOptional: h.isOptional },
      });
    }
  }

  // --- Leave Types ---
  const annualLeave = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'AL' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Annual Leave', code: 'AL',
      daysPerYear: 20, isPaid: true, requiresApproval: true,
    },
  });

  const sickLeave = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'SL' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Sick Leave', code: 'SL',
      daysPerYear: 12, isPaid: true, requiresApproval: false,
    },
  });

  const personalLeave = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'PL' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Personal Leave', code: 'PL',
      daysPerYear: 5, isPaid: false, requiresApproval: true,
    },
  });

  const maternityLeave = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: 'ML' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Maternity Leave', code: 'ML',
      daysPerYear: 90, isPaid: true, requiresApproval: true,
      carryForward: false,
    },
  });

  // --- Additional Users + Employees ---
  const empRole = await prisma.role.findFirstOrThrow({
    where: { companyId: null, slug: 'employee' },
  });
  const payrollRole = await prisma.role.findFirstOrThrow({
    where: { companyId: null, slug: 'payroll-manager' },
  });
  const deptHeadRole = await prisma.role.findFirstOrThrow({
    where: { companyId: null, slug: 'department-head' },
  });

  interface EmployeeSeed {
    email: string; password: string; roleSlug: string;
    code: string; firstName: string; lastName: string;
    departmentId: string; designation: string; gender: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfJoining: Date; salary: number;
  }

  const employeesToSeed: EmployeeSeed[] = [
    {
      email: 'alice@demo.com', password: 'Demo123!', roleSlug: 'employee',
      code: 'EMP-0002', firstName: 'Alice', lastName: 'Johnson',
      departmentId: engineeringDept.id, designation: 'Software Engineer',
      gender: 'FEMALE', dateOfJoining: new Date(currentYear - 2, 5, 1), salary: 75000,
    },
    {
      email: 'bob@demo.com', password: 'Demo123!', roleSlug: 'employee',
      code: 'EMP-0003', firstName: 'Bob', lastName: 'Smith',
      departmentId: engineeringDept.id, designation: 'Senior Software Engineer',
      gender: 'MALE', dateOfJoining: new Date(currentYear - 4, 2, 15), salary: 110000,
    },
    {
      email: 'carol@demo.com', password: 'Demo123!', roleSlug: 'department-head',
      code: 'EMP-0004', firstName: 'Carol', lastName: 'Williams',
      departmentId: engineeringDept.id, designation: 'Engineering Manager',
      gender: 'FEMALE', dateOfJoining: new Date(currentYear - 6, 1, 10), salary: 145000,
    },
    {
      email: 'david@demo.com', password: 'Demo123!', roleSlug: 'employee',
      code: 'EMP-0005', firstName: 'David', lastName: 'Brown',
      departmentId: salesDept.id, designation: 'Sales Representative',
      gender: 'MALE', dateOfJoining: new Date(currentYear - 1, 8, 1), salary: 55000,
    },
    {
      email: 'eve@demo.com', password: 'Demo123!', roleSlug: 'employee',
      code: 'EMP-0006', firstName: 'Eve', lastName: 'Davis',
      departmentId: marketingDept.id, designation: 'Marketing Specialist',
      gender: 'FEMALE', dateOfJoining: new Date(currentYear - 3, 3, 20), salary: 65000,
    },
    {
      email: 'frank@demo.com', password: 'Demo123!', roleSlug: 'department-head',
      code: 'EMP-0007', firstName: 'Frank', lastName: 'Miller',
      departmentId: salesDept.id, designation: 'Sales Manager',
      gender: 'MALE', dateOfJoining: new Date(currentYear - 5, 6, 5), salary: 125000,
    },
    {
      email: 'grace@demo.com', password: 'Demo123!', roleSlug: 'payroll-manager',
      code: 'EMP-0008', firstName: 'Grace', lastName: 'Wilson',
      departmentId: hrDept.id, designation: 'HR Manager',
      gender: 'FEMALE', dateOfJoining: new Date(currentYear - 3, 2, 1), salary: 85000,
    },
    {
      email: 'henry@demo.com', password: 'Demo123!', roleSlug: 'recruiter',
      code: 'EMP-0009', firstName: 'Henry', lastName: 'Taylor',
      departmentId: hrDept.id, designation: 'HR Executive',
      gender: 'MALE', dateOfJoining: new Date(currentYear - 1, 9, 15), salary: 55000,
    },
  ];

  const createdEmployeeIds: string[] = [];
  for (const emp of employeesToSeed) {
    let user = await prisma.user.findFirst({
      where: { companyId: demoCompany.id, email: emp.email },
    });
    if (!user) {
      const hash = await bcrypt.hash(emp.password, 10);
      user = await prisma.user.create({
        data: {
          companyId: demoCompany.id, email: emp.email, passwordHash: hash,
          status: 'ACTIVE', isEmailVerified: true,
        },
      });
      // Assign appropriate role
      const role = emp.roleSlug === 'department-head' ? deptHeadRole
        : emp.roleSlug === 'payroll-manager' ? payrollRole
        : empRole;
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

      const designationId = createdDesignations[emp.designation];
      const employee = await prisma.employee.create({
        data: {
          companyId: demoCompany.id, userId: user.id,
          employeeCode: emp.code, firstName: emp.firstName, lastName: emp.lastName,
          workEmail: emp.email, dateOfJoining: emp.dateOfJoining,
          departmentId: emp.departmentId, designationId,
          gender: emp.gender, employmentType: 'FULL_TIME',
          shiftId: generalShift.id, status: 'ACTIVE',
          branchId: emp.departmentId === salesDept.id ? nyBranch.id : headOffice.id,
        },
      });
      createdEmployeeIds.push(employee.id);
    } else {
      // Employee already exists — grab their ID for downstream data creation
      const employee = await prisma.employee.findFirst({
        where: { companyId: demoCompany.id, userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (employee) createdEmployeeIds.push(employee.id);
    }
  }

  // --- Salary Structure ---
  const standardStructure = await prisma.salaryStructure.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      companyId: demoCompany.id,
      name: 'Standard Engineering',
      basic: 50000, housingAllowance: 15000, transportAllowance: 5000,
      medicalAllowance: 5000, otherAllowances: 2000,
      taxPercent: 20, pensionPercent: 5, insuranceDeduction: 2000,
    },
  });

  const premiumStructure = await prisma.salaryStructure.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      companyId: demoCompany.id,
      name: 'Premium Engineering',
      basic: 80000, housingAllowance: 25000, transportAllowance: 10000,
      medicalAllowance: 10000, otherAllowances: 5000,
      taxPercent: 25, pensionPercent: 6, insuranceDeduction: 3000,
    },
  });

  // --- Employee Salaries ---
  // We'll create salaries for the employees we just created
  const salaryConfigs = [
    { employeeIdx: 0, basic: 45000, housing: 12000, transport: 4000, medical: 4000, other: 2000, tax: 18, pension: 4, insurance: 1500 },
    { employeeIdx: 1, basic: 65000, housing: 18000, transport: 6000, medical: 6000, other: 3000, tax: 22, pension: 5, insurance: 2500 },
    { employeeIdx: 2, basic: 85000, housing: 25000, transport: 8000, medical: 8000, other: 5000, tax: 25, pension: 6, insurance: 3000 },
    { employeeIdx: 3, basic: 35000, housing: 10000, transport: 3000, medical: 3000, other: 1500, tax: 15, pension: 4, insurance: 1000 },
    { employeeIdx: 4, basic: 40000, housing: 11000, transport: 3500, medical: 3500, other: 1500, tax: 16, pension: 4, insurance: 1200 },
    { employeeIdx: 5, basic: 75000, housing: 20000, transport: 7000, medical: 7000, other: 4000, tax: 24, pension: 5, insurance: 2500 },
  ];
  for (const sc of salaryConfigs) {
    const empId = createdEmployeeIds[sc.employeeIdx];
    if (!empId) continue;
    const exists = await prisma.employeeSalary.findFirst({
      where: { employeeId: empId, isActive: true },
    });
    if (!exists) {
      await prisma.employeeSalary.create({
        data: {
          companyId: demoCompany.id, employeeId: empId, structureId: standardStructure.id,
          effectiveFrom: new Date(currentYear, 0, 1),
          basic: sc.basic, housingAllowance: sc.housing, transportAllowance: sc.transport,
          medicalAllowance: sc.medical, otherAllowances: sc.other,
          taxPercent: sc.tax, pensionPercent: sc.pension, insuranceDeduction: sc.insurance,
          isActive: true,
        },
      });
    }
  }

  // --- Reimbursement Categories ---
  const reimbCategories = [
    { name: 'Travel', description: 'Business travel expenses' },
    { name: 'Meals', description: 'Client meals and team lunches' },
    { name: 'Office Supplies', description: 'Stationery and small office items' },
    { name: 'Internet', description: 'Home internet reimbursement' },
  ];
  for (const cat of reimbCategories) {
    const exists = await prisma.reimbursementCategory.findFirst({
      where: { companyId: demoCompany.id, name: cat.name },
    });
    if (!exists) {
      await prisma.reimbursementCategory.create({
        data: { companyId: demoCompany.id, name: cat.name, description: cat.description, maxAmount: 500 },
      });
    }
  }

  // --- Reimbursements (sample) ---
  if (createdEmployeeIds.length > 0) {
    const travelCat = await prisma.reimbursementCategory.findFirst({
      where: { companyId: demoCompany.id, name: 'Travel' },
    });
    if (travelCat) {
      const exists = await prisma.reimbursement.findFirst({
        where: { employeeId: createdEmployeeIds[0], status: 'PENDING' },
      });
      if (!exists) {
        await prisma.reimbursement.create({
          data: {
            companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
            categoryId: travelCat.id, amount: 250, description: 'Client visit taxi fare',
            status: 'PENDING',
          },
        });
        await prisma.reimbursement.create({
          data: {
            companyId: demoCompany.id, employeeId: createdEmployeeIds[1],
            categoryId: travelCat.id, amount: 180, description: 'Airport pickup',
            status: 'APPROVED',
          },
        });
      }
    }
  }

  // --- Job Postings ---
  await prisma.jobPosting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      companyId: demoCompany.id, departmentId: engineeringDept.id,
      title: 'Senior Frontend Developer', location: 'San Francisco, CA',
      employmentType: 'FULL_TIME', minSalary: 120000, maxSalary: 160000,
      description: 'We are looking for an experienced frontend developer to join our growing team.',
      requirements: '5+ years experience with React, TypeScript, and modern CSS.',
      openings: 2, status: 'PUBLISHED', publishedAt: new Date(),
    },
  });

  await prisma.jobPosting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      companyId: demoCompany.id, departmentId: salesDept.id,
      title: 'Sales Executive', location: 'New York, NY',
      employmentType: 'FULL_TIME', minSalary: 60000, maxSalary: 80000,
      description: 'Join our dynamic sales team and drive business growth.',
      requirements: '2+ years B2B sales experience preferred.',
      openings: 3, status: 'PUBLISHED', publishedAt: new Date(),
    },
  });

  await prisma.jobPosting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      companyId: demoCompany.id, departmentId: engineeringDept.id,
      title: 'DevOps Engineer', location: 'San Francisco, CA',
      employmentType: 'FULL_TIME', minSalary: 130000, maxSalary: 170000,
      description: 'Help us build and maintain our cloud infrastructure.',
      requirements: '3+ years experience with AWS, Docker, and Kubernetes.',
      openings: 1, status: 'DRAFT', publishedAt: null,
    },
  });

  // --- Job Applications (sample) ---
  const frontendJob = await prisma.jobPosting.findFirst({
    where: { companyId: demoCompany.id, title: 'Senior Frontend Developer' },
  });
  if (frontendJob) {
    const exists = await prisma.jobApplication.findFirst({
      where: { companyId: demoCompany.id, jobPostingId: frontendJob.id },
    });
    if (!exists) {
      const app1 = await prisma.jobApplication.create({
        data: {
          companyId: demoCompany.id, jobPostingId: frontendJob.id,
          candidateName: 'Jane Doe', candidateEmail: 'jane.doe@example.com',
          candidatePhone: '+1-555-0101', status: 'NEW',
        },
      });
      const app2 = await prisma.jobApplication.create({
        data: {
          companyId: demoCompany.id, jobPostingId: frontendJob.id,
          candidateName: 'John Smith', candidateEmail: 'john.smith@example.com',
          status: 'INTERVIEW',
        },
      });
      // Create a sample interview
      await prisma.interview.upsert({
        where: { id: '00000000-0000-0000-0000-000000000030' },
        update: {},
        create: {
          id: '00000000-0000-0000-0000-000000000030',
          companyId: demoCompany.id, applicationId: app2.id,
          title: 'Technical Interview - Frontend',
          type: 'Technical',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60, status: 'SCHEDULED',
        },
      });
    }
  }

  // --- Assets ---
  const assets = [
    { name: 'MacBook Pro 16\"', type: 'LAPTOP' as const, serial: 'SN-MBP-001', brand: 'Apple' },
    { name: 'Dell Monitor 27\"', type: 'OTHER' as const, serial: 'SN-DEL-001', brand: 'Dell' },
    { name: 'iPhone 15 Pro', type: 'MOBILE' as const, serial: 'SN-IPH-001', brand: 'Apple' },
    { name: 'iPad Air', type: 'TABLET' as const, serial: 'SN-IPD-001', brand: 'Apple' },
  ];
  const createdAssetIds: string[] = [];
  for (const a of assets) {
    const exists = await prisma.asset.findFirst({
      where: { companyId: demoCompany.id, serialNumber: a.serial },
    });
    if (!exists) {
      const asset = await prisma.asset.create({
        data: {
          companyId: demoCompany.id, name: a.name, type: a.type,
          serialNumber: a.serial, brand: a.brand, isActive: true,
        },
      });
      createdAssetIds.push(asset.id);
    }
  }

  // --- Asset Assignments ---
  if (createdEmployeeIds.length > 0 && createdAssetIds.length > 0) {
    const exists = await prisma.assetAssignment.findFirst({
      where: { companyId: demoCompany.id, assetId: createdAssetIds[0] },
    });
    if (!exists) {
      await prisma.assetAssignment.create({
        data: {
          companyId: demoCompany.id, assetId: createdAssetIds[0],
          employeeId: createdEmployeeIds[0], status: 'ASSIGNED',
        },
      });
      await prisma.assetAssignment.create({
        data: {
          companyId: demoCompany.id, assetId: createdAssetIds[2],
          employeeId: createdEmployeeIds[1], status: 'ASSIGNED',
        },
      });
    }
  }

  // --- Training Programs ---
  const trainings = [
    { title: 'AWS Cloud Practitioner Certification', description: 'Prepare for the AWS Cloud Practitioner exam.', mode: 'ONLINE', duration: '3 days' },
    { title: 'Leadership & Management Workshop', description: 'Develop leadership skills for team leads and managers.', mode: 'OFFLINE', duration: '2 days' },
    { title: 'React Advanced Patterns', description: 'Deep dive into advanced React patterns and performance.', mode: 'ONLINE', duration: '1 day' },
  ];
  for (const t of trainings) {
    const exists = await prisma.training.findFirst({
      where: { companyId: demoCompany.id, title: t.title },
    });
    if (!exists) {
      const training = await prisma.training.create({
        data: {
          companyId: demoCompany.id, title: t.title, description: t.description,
          mode: t.mode, duration: t.duration,
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          maxParticipants: 20, status: 'UPCOMING',
        },
      });
      // Enroll the first employee
      if (createdEmployeeIds.length > 0) {
        await prisma.trainingEnrollment.upsert({
          where: {
            trainingId_employeeId: { trainingId: training.id, employeeId: createdEmployeeIds[0] },
          },
          update: {},
          create: {
            companyId: demoCompany.id, trainingId: training.id,
            employeeId: createdEmployeeIds[0], status: 'ENROLLED',
          },
        });
      }
    }
  }

  // --- Attendance Records (today) ---
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < Math.min(createdEmployeeIds.length, 4); i++) {
    const empId = createdEmployeeIds[i];
    const exists = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: empId, date: today } },
    });
    if (!exists) {
      const checkIn = new Date();
      checkIn.setUTCHours(9, 5, 0, 0);
      const checkOut = new Date();
      checkOut.setUTCHours(17, 45, 0, 0);
      const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);

      await prisma.attendanceRecord.create({
        data: {
          companyId: demoCompany.id, employeeId: empId, date: today,
          checkIn, checkOut, workedMinutes, status: 'PRESENT', source: 'WEB',
        },
      });
    }
  }

  // --- Leave Balances (current year) ---
  const leaveTypes = [annualLeave, sickLeave, personalLeave];
  for (const empId of createdEmployeeIds) {
    for (const lt of leaveTypes) {
      const exists = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: empId, leaveTypeId: lt.id, year: currentYear,
          },
        },
      });
      if (!exists) {
        await prisma.leaveBalance.create({
          data: {
            companyId: demoCompany.id, employeeId: empId,
            leaveTypeId: lt.id, year: currentYear,
            allocated: lt.daysPerYear, used: 0, carriedForward: 0,
          },
        });
      }
    }
  }

  // --- One completed leave request (approved) ---
  if (createdEmployeeIds.length > 0) {
    const pastStart = new Date(currentYear, 5, 10);
    const pastEnd = new Date(currentYear, 5, 12);
    const exists = await prisma.leaveRequest.findFirst({
      where: { employeeId: createdEmployeeIds[0], startDate: pastStart },
    });
    if (!exists) {
      await prisma.leaveRequest.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
          leaveTypeId: annualLeave.id,
          startDate: pastStart, endDate: pastEnd, totalDays: 3,
          reason: 'Family vacation', status: 'APPROVED',
        },
      });
    }
  }

  // ====================================================================
  // Phase 3: Additional comprehensive data for end-to-end testing
  // ====================================================================
  console.log('Seeding Phase 3: Additional comprehensive data...');

  // --- Teams ---
  const alphaTeam = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      companyId: demoCompany.id, departmentId: engineeringDept.id,
      name: 'Alpha Team', isActive: true,
    },
  });

  const betaTeam = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      companyId: demoCompany.id, departmentId: engineeringDept.id,
      name: 'Beta Team', isActive: true,
    },
  });

  const salesTeam = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      companyId: demoCompany.id, departmentId: salesDept.id,
      name: 'Enterprise Sales', isActive: true,
    },
  });

  // Assign employees to teams
  if (createdEmployeeIds.length >= 3) {
    await prisma.employee.update({ where: { id: createdEmployeeIds[0] }, data: { teamId: alphaTeam.id } });
    await prisma.employee.update({ where: { id: createdEmployeeIds[1] }, data: { teamId: betaTeam.id } });
    await prisma.employee.update({ where: { id: createdEmployeeIds[3] }, data: { teamId: salesTeam.id } });
  }

  // --- Attendance Records (past dates with varied statuses) ---
  const attendanceStatuses = ['PRESENT', 'LATE', 'PRESENT', 'HALF_DAY', 'ABSENT', 'PRESENT', 'LATE', 'PRESENT'];
  if (createdEmployeeIds.length > 0) {
    for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
      const pastDate = new Date(today);
      pastDate.setUTCDate(pastDate.getUTCDate() - daysAgo);
      const statusIdx = daysAgo % attendanceStatuses.length;
      const status = attendanceStatuses[statusIdx] as any;

      for (let e = 0; e < Math.min(createdEmployeeIds.length, 3); e++) {
        const empId = createdEmployeeIds[e];
        const exists = await prisma.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: empId, date: pastDate } },
        });
        if (!exists && status !== 'ABSENT') {
          const hour = 8 + (daysAgo % 3);
          const checkIn = new Date(pastDate);
          checkIn.setUTCHours(hour, 5 + (daysAgo % 20), 0, 0);
          const checkOut = new Date(pastDate);
          checkOut.setUTCHours(hour + 8, 45, 0, 0);
          const workedMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);

          await prisma.attendanceRecord.create({
            data: {
              companyId: demoCompany.id, employeeId: empId, date: pastDate,
              checkIn, checkOut, workedMinutes, status, source: 'WEB',
            },
          });
        } else if (!exists && status === 'HALF_DAY') {
          const checkIn = new Date(pastDate);
          checkIn.setUTCHours(10, 0, 0, 0);
          const checkOut = new Date(pastDate);
          checkOut.setUTCHours(14, 0, 0, 0);
          const workedMinutes = 240;
          await prisma.attendanceRecord.create({
            data: {
              companyId: demoCompany.id, employeeId: empId, date: pastDate,
              checkIn, checkOut, workedMinutes, status: 'HALF_DAY', source: 'WEB',
            },
          });
        }
      }
    }
  }

  // --- Leave Requests (varied states) ---
  if (createdEmployeeIds.length > 1) {
    // PENDING leave request
    const pendingExists = await prisma.leaveRequest.findFirst({
      where: { employeeId: createdEmployeeIds[1], status: 'PENDING' },
    });
    if (!pendingExists) {
      await prisma.leaveRequest.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[1],
          leaveTypeId: annualLeave.id,
          startDate: new Date(currentYear, 7, 15), endDate: new Date(currentYear, 7, 16),
          totalDays: 2, reason: 'Personal errands', status: 'PENDING',
        },
      });
    }

    // REJECTED leave request
    const rejectedExists = await prisma.leaveRequest.findFirst({
      where: { employeeId: createdEmployeeIds[2], status: 'REJECTED' },
    });
    if (!rejectedExists) {
      await prisma.leaveRequest.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[2],
          leaveTypeId: personalLeave.id,
          startDate: new Date(currentYear, 4, 5), endDate: new Date(currentYear, 4, 5),
          totalDays: 1, reason: 'Weekend trip', status: 'REJECTED',
          rejectionReason: 'Team understaffed during that period.',
        },
      });
    }

    // CANCELLED leave request
    const cancelledExists = await prisma.leaveRequest.findFirst({
      where: { employeeId: createdEmployeeIds[3], status: 'CANCELLED' },
    });
    if (!cancelledExists) {
      await prisma.leaveRequest.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[3],
          leaveTypeId: sickLeave.id,
          startDate: new Date(currentYear, 2, 10), endDate: new Date(currentYear, 2, 12),
          totalDays: 3, reason: 'Was feeling unwell but recovered', status: 'CANCELLED',
        },
      });
    }
  }

  // --- Attendance Regularizations ---
  if (createdEmployeeIds.length > 0) {
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    // PENDING regularization
    const pendingRegExists = await prisma.attendanceRegularization.findFirst({
      where: { employeeId: createdEmployeeIds[0], status: 'PENDING' },
    });
    if (!pendingRegExists) {
      await prisma.attendanceRegularization.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
          date: threeDaysAgo, reason: 'Forgot to clock in on time due to network issues',
          requestedCheckIn: new Date(threeDaysAgo.getTime() + 9 * 60 * 60 * 1000),
          requestedStatus: 'PRESENT', status: 'PENDING',
        },
      });
    }

    // APPROVED regularization
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
    const approvedRegExists = await prisma.attendanceRegularization.findFirst({
      where: { employeeId: createdEmployeeIds[1], status: 'APPROVED' },
    });
    if (!approvedRegExists) {
      await prisma.attendanceRegularization.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[1],
          date: fiveDaysAgo, reason: 'Had to leave early due to medical appointment',
          requestedCheckOut: new Date(fiveDaysAgo.getTime() + 15 * 60 * 60 * 1000),
          requestedStatus: 'PRESENT', status: 'APPROVED',
          approvedById: createdEmployeeIds[0],
          approvedAt: new Date(),
        },
      });
    }

    // REJECTED regularization
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const rejectedRegExists = await prisma.attendanceRegularization.findFirst({
      where: { employeeId: createdEmployeeIds[2], status: 'REJECTED' },
    });
    if (!rejectedRegExists) {
      await prisma.attendanceRegularization.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[2],
          date: sevenDaysAgo, reason: 'Was stuck in traffic',
          status: 'REJECTED',
          rejectionReason: 'No GPS data to verify the claim.',
          approvedById: createdEmployeeIds[0],
          approvedAt: new Date(),
        },
      });
    }
  }

  // --- Payroll Runs ---
  const currentMonth = new Date().getMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Use findFirst + update/create instead of upsert due to unique constraint change
  let completedRun = await prisma.payrollRun.findFirst({
    where: { companyId: demoCompany.id, month: prevMonth, year: prevMonthYear, version: 1 },
  });

  if (!completedRun) {
    completedRun = await prisma.payrollRun.create({
      data: {
        id: '00000000-0000-0000-0000-000000000040',
        companyId: demoCompany.id,
        month: prevMonth,
        year: prevMonthYear,
        version: 1,
        status: 'COMPLETED',
        processedAt: new Date(),
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        employeeCount: 0,
        notes: 'Regular monthly payroll',
      },
    });
  }

  // --- Payslips for completed run ---
  if (createdEmployeeIds.length > 0) {
    for (let i = 0; i < Math.min(createdEmployeeIds.length, 6); i++) {
      const empId = createdEmployeeIds[i];
      const es = salaryConfigs[i];
      if (!es) continue;

      const basic = es.basic;
      const housing = es.housing;
      const transport = es.transport;
      const medical = es.medical;
      const other = es.other;
      const gross = basic + housing + transport + medical + other;
      const tax = Math.round(gross * (es.tax / 100));
      const pension = Math.round(gross * (es.pension / 100));
      const insurance = es.insurance;
      const deductions = tax + pension + insurance;
      const net = gross - deductions;

      const exists = await prisma.payslip.findFirst({
        where: { employeeId: empId, runId: completedRun.id },
      });
      if (!exists) {
        await prisma.payslip.create({
          data: {
            companyId: demoCompany.id, employeeId: empId, runId: completedRun.id,
            basic, housingAllowance: housing, transportAllowance: transport,
            medicalAllowance: medical, otherAllowances: other,
            grossPay: gross, taxDeduction: tax, pensionDeduction: pension,
            insuranceDeduction: insurance, loanDeduction: 0,
            totalDeductions: deductions, netPay: Math.max(net, 0),
            status: 'PAID', paidAt: new Date(),
          },
        });
      }
    }

    // Update the run totals
    const payslipsForRun = await prisma.payslip.findMany({ where: { runId: completedRun.id } });
    const totalGross = payslipsForRun.reduce((sum, p) => sum + p.grossPay, 0);
    const totalDeductions = payslipsForRun.reduce((sum, p) => sum + p.totalDeductions, 0);
    const totalNet = payslipsForRun.reduce((sum, p) => sum + p.netPay, 0);
    await prisma.payrollRun.update({
      where: { id: completedRun.id },
      data: { totalGross, totalDeductions, totalNet, employeeCount: payslipsForRun.length },
    });
  }

  // --- Loans with Repayments ---
  if (createdEmployeeIds.length >= 2) {
    const loanExists = await prisma.loan.findFirst({
      where: { employeeId: createdEmployeeIds[0] },
    });
    if (!loanExists) {
      const loanAmount = 5000;
      const interestRate = 5;
      const totalAmount = loanAmount + (loanAmount * interestRate / 100);
      const repaymentMonths = 6;
      const monthlyInstallment = Math.ceil(totalAmount / repaymentMonths);

      const loan1 = await prisma.loan.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
          loanType: 'PERSONAL', amount: loanAmount, totalAmount,
          interestRate, repaymentMonths, monthlyInstallment,
          purpose: 'Home office setup', status: 'ACTIVE',
          approvedById: createdEmployeeIds[2],
          approvedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          disbursedAt: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000),
        },
      });

      // Create repayment schedule (6 monthly installments)
      for (let m = 1; m <= repaymentMonths; m++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + m - 3); // First due 3 months ago
        const status = m <= 2 ? 'PAID' : 'PENDING';
        await prisma.loanRepayment.create({
          data: {
            loanId: loan1.id,
            amount: monthlyInstallment,
            dueDate,
            status,
            paidAt: status === 'PAID' ? new Date() : null,
          },
        });
      }
    }

    // A PENDING loan for another employee
    const pendingLoanExists = await prisma.loan.findFirst({
      where: { employeeId: createdEmployeeIds[1], status: 'PENDING' },
    });
    if (!pendingLoanExists) {
      await prisma.loan.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[1],
          loanType: 'ADVANCE', amount: 2000, totalAmount: 2000,
          interestRate: 0, repaymentMonths: 3, monthlyInstallment: 667,
          purpose: 'Travel advance', status: 'PENDING',
        },
      });
    }
  }

  // --- Employee Documents ---
  if (createdEmployeeIds.length > 0) {
    const docExists = await prisma.employeeDocument.findFirst({
      where: { employeeId: createdEmployeeIds[0] },
    });
    if (!docExists) {
      await prisma.employeeDocument.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
          name: 'Employment Contract.pdf', category: 'CONTRACT',
          fileUrl: '/uploads/contract-alice.pdf',
          fileSize: 245760, mimeType: 'application/pdf',
          notes: 'Signed employment agreement',
        },
      });
      await prisma.employeeDocument.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[1],
          name: 'Degree Certificate.pdf', category: 'EDUCATION',
          fileUrl: '/uploads/degree-bob.pdf',
          fileSize: 512000, mimeType: 'application/pdf',
          notes: 'B.Tech Computer Science',
        },
      });
    }
  }

  // --- Tax Declarations ---
  if (createdEmployeeIds.length > 0) {
    const taxYear = `${currentYear}-${(currentYear + 1).toString().slice(2)}`;
    const taxExists = await prisma.taxDeclaration.findFirst({
      where: { employeeId: createdEmployeeIds[0] },
    });
    if (!taxExists) {
      await prisma.taxDeclaration.create({
        data: {
          companyId: demoCompany.id, employeeId: createdEmployeeIds[0],
          financialYear: taxYear, panNumber: 'ABCDE1234F',
          declarations: {
            hra: 120000, '80c': 150000, '80d': 25000,
            nps: 50000, homeLoan: 0,
          },
          totalIncome: 750000, totalDeductions: 345000, totalTaxPaid: 45000,
          status: 'SUBMITTED', submittedAt: new Date(),
        },
      });
    }
  }

  // --- Attendance Policy ---
  const policyExists = await prisma.attendancePolicy.findUnique({
    where: { companyId: demoCompany.id },
  });
  if (!policyExists) {
    await prisma.attendancePolicy.create({
      data: {
        companyId: demoCompany.id,
        name: 'Default Policy',
        timezone: 'UTC',
        workingDays: [1, 2, 3, 4, 5],
        defaultStartTime: '09:00',
        defaultEndTime: '18:00',
        dailyWorkingHours: 9,
        breakDurationMinutes: 60,
        gracePeriodMinutes: 15,
        lateThresholdMinutes: 30,
        veryLateThresholdMinutes: 60,
        halfDayThresholdMinutes: 240,
        minimumWorkingMinutes: 480,
        maximumWorkingMinutes: 720,
        enableOvertime: true,
        overtimeStartsAfterMinutes: 540,
        maxOvertimeMinutes: 240,
        enableAutoLateDetection: true,
        enableAutoHalfDay: true,
        enableAutoAbsent: true,
        enableAutoCheckout: true,
        crossMidnightShift: false,
      },
    });
    console.log('Default attendance policy created for demo company');
  }

  // --- Attendance Security Config ---
  const securityConfigExists = await prisma.attendanceSecurityConfig.findFirst({
    where: { companyId: demoCompany.id },
  });
  if (!securityConfigExists) {
    await prisma.attendanceSecurityConfig.create({
      data: {
        companyId: demoCompany.id,
        requireTrustedDevice: false,
        requireWifiVerification: false,
        requireIpValidation: false,
        strictMode: false,
      },
    });
  }

  // --- Indian Statutory Compliance Config (Company-level) ---
  const complianceConfigExists = await prisma.complianceConfig.findFirst({
    where: { companyId: demoCompany.id },
  });
  if (!complianceConfigExists) {
    await prisma.complianceConfig.create({
      data: {
        companyId: demoCompany.id,
        enablePf: true,
        pfWageCeiling: 15000,
        pfEmployeePct: 12,
        pfEmployerPct: 13,
        enableEsi: true,
        esiWageCeiling: 21000,
        esiEmployeePct: 0.75,
        esiEmployerPct: 3.25,
        enablePt: true,
        ptState: 'KARNATAKA',
        enableTds: true,
        tdsRegime: 'NEW',
      },
    });
  }

  // --- Company Branding ---
  const brandingExists = await prisma.companyBranding.findFirst({
    where: { companyId: demoCompany.id },
  });
  if (!brandingExists) {
    await prisma.companyBranding.create({
      data: {
        companyId: demoCompany.id,
        primaryColor: '#0B6E63',
        secondaryColor: '#10192B',
        accentColor: '#4DB6A8',
        companyName: 'Demo Company',
        enabled: false,
      },
    });
  }

  // ====================================================================
  // Seed default document templates
  // ====================================================================
  console.log('Seeding default document templates...');
  const { DocumentTemplatesService } = await import('../src/document-templates/document-templates.service');
  // We can't instantiate the full service here, so we create default templates directly
  const defaultTemplates = [
    {
      name: 'Offer Letter',
      slug: 'offer-letter',
      category: 'OFFER_LETTER',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #0B6E63;padding-bottom:15px;margin-bottom:25px}.header h1{color:#0B6E63;font-size:22pt}.subject{font-weight:600;margin:20px 0}.signature{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>Dear <strong>{{candidateName}}</strong>,</p><p>We are delighted to offer you the position of <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p><p>Your employment will commence on <strong>{{joiningDate}}</strong>.</p><p>Annual CTC: <strong>{{salary}}</strong></p><div class="signature"><p>Sincerely,</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Standard employment offer letter',
      variables: ['candidateName', 'position', 'department', 'joiningDate', 'salary', 'companyName', 'hrName'],
    },
    {
      name: 'Appointment Letter',
      slug: 'appointment-letter',
      category: 'APPOINTMENT_LETTER',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #10192B;padding-bottom:15px;margin-bottom:25px}.header h1{color:#10192B;font-size:22pt}.subject{font-weight:600;margin:20px 0}.signature{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>Dear <strong>{{employeeName}}</strong>,</p><p>We confirm your appointment as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p><p>Date of Joining: <strong>{{joiningDate}}</strong></p><p>Reporting Manager: <strong>{{reportingManager}}</strong></p><div class="signature"><p>Yours sincerely,</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Confirms appointment with terms of employment',
      variables: ['employeeName', 'position', 'department', 'joiningDate', 'employmentType', 'probationPeriod', 'reportingManager', 'companyName', 'hrName'],
    },
    {
      name: 'Experience Letter',
      slug: 'experience-letter',
      category: 'EXPERIENCE_LETTER',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #4DB6A8;padding-bottom:15px;margin-bottom:25px}.header h1{color:#4DB6A8;font-size:22pt}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>TO WHOM IT MAY CONCERN</p><p>This certifies that <strong>{{employeeName}}</strong> was employed from <strong>{{startDate}}</strong> to <strong>{{endDate}}</strong> as <strong>{{position}}</strong>.</p><p>We wish them the best in future endeavors.</p><div class="signature"><p>Sincerely,</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Certificate of experience upon exit',
      variables: ['employeeName', 'position', 'department', 'startDate', 'endDate', 'companyName', 'hrName'],
    },
    {
      name: 'Relieving Letter',
      slug: 'relieving-letter',
      category: 'RELIEVING_LETTER',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #10192B;padding-bottom:15px;margin-bottom:25px}.header h1{color:#10192B;font-size:22pt}.subject{font-weight:600;margin:20px 0}.signature{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>Dear <strong>{{employeeName}}</strong>,</p><p>We refer to your resignation and confirm you are relieved from duties effective <strong>{{lastWorkingDay}}</strong>.</p><p>You worked as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p><div class="signature"><p>Yours sincerely,</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Official release letter upon resignation',
      variables: ['employeeName', 'position', 'department', 'lastWorkingDay', 'resignationDate', 'companyName', 'hrName'],
    },
    {
      name: 'Salary Certificate',
      slug: 'salary-certificate',
      category: 'SALARY_CERTIFICATE',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #0B6E63;padding-bottom:15px;margin-bottom:25px}.header h1{color:#0B6E63;font-size:22pt}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>This certifies that <strong>{{employeeName}}</strong> is employed as <strong>{{position}}</strong>.</p><p><strong>Annual CTC: {{totalCTC}}</strong></p><div class="signature"><p>Authorized Signatory</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Proof of income showing salary breakdown',
      variables: ['employeeName', 'position', 'department', 'basicSalary', 'totalCTC', 'effectiveDate', 'companyName', 'hrName'],
    },
    {
      name: 'Confirmation Letter',
      slug: 'confirmation-letter',
      category: 'CONFIRMATION_LETTER',
      isDefault: true,
      content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;padding:20px}.header{text-align:center;border-bottom:2px solid #0B6E63;padding-bottom:15px;margin-bottom:25px}.header h1{color:#0B6E63;font-size:22pt}</style></head><body><div class="header"><h1>{{companyName}}</h1></div><p>Dear <strong>{{employeeName}}</strong>,</p><p>Congratulations! We are pleased to confirm your employment with <strong>{{companyName}}</strong> effective <strong>{{effectiveDate}}</strong>.</p><p>During your probation, you have demonstrated the skills and dedication we value. We look forward to your continued contributions.</p><div class="signature"><p>Sincerely,</p><p><strong>{{hrName}}</strong></p></div></body></html>`,
      description: 'Confirms permanent employment after probation',
      variables: ['employeeName', 'position', 'department', 'effectiveDate', 'companyName', 'hrName'],
    },
  ];

  for (const tmpl of defaultTemplates) {
    const exists = await prisma.documentTemplate.findFirst({
      where: { companyId: demoCompany.id, slug: tmpl.slug },
    });
    if (!exists) {
      await prisma.documentTemplate.create({
        data: {
          companyId: demoCompany.id,
          name: tmpl.name,
          slug: tmpl.slug,
          category: tmpl.category as any,
          content: tmpl.content,
          description: tmpl.description,
          variables: tmpl.variables,
          isDefault: tmpl.isDefault,
        },
      });
      console.log(`  Created template: ${tmpl.name}`);
    }
  }

  console.log('---------------------------------------------');
  console.log('Seed complete.');
  console.log(`Super Admin:    ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`Demo HR:        ${demoHrEmail} / ${demoHrPassword}`);
  console.log(`Demo company:   ${demoCompany.slug}`);
  console.log(`Additional employees created: ${createdEmployeeIds.length}`);
  console.log('---------------------------------------------');
  console.log('');
  console.log('--- Users & Roles for E2E Testing ---');
  console.log('superadmin@hrms.io / ChangeMe123! (Platform Super Admin - no company)');
  console.log('hr@demo.com / Demo123! (HR Manager - demo-company)');
  console.log('alice@demo.com / Demo123! (Employee - Engineering)');
  console.log('bob@demo.com / Demo123! (Employee - Engineering)');
  console.log('carol@demo.com / Demo123! (Department Head - Engineering)');
  console.log('david@demo.com / Demo123! (Employee - Sales)');
  console.log('eve@demo.com / Demo123! (Employee - Marketing)');
  console.log('frank@demo.com / Demo123! (Department Head - Sales)');
  console.log('grace@demo.com / Demo123! (Payroll Manager - HR)');
  console.log('henry@demo.com / Demo123! (Recruiter - HR)');
  console.log('');
  console.log('--- Key Data ---');
  console.log(`Completed payroll run: Month ${prevMonth}/${prevMonthYear}`);
  console.log(`Active loan for Alice with repayments`);
  console.log(`14 days of varied attendance records`);
  console.log(`Leave requests in PENDING, APPROVED, REJECTED, CANCELLED states`);
  console.log(`Attendance regularizations in PENDING, APPROVED, REJECTED states`);
  console.log('---------------------------------------------');

  // Store IDs for use by external processes if needed
  (global as any).__seedIds = {
    companyId: demoCompany.id,
    employeeIds: createdEmployeeIds,
    completedRunId: completedRun ? completedRun.id : null,
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
