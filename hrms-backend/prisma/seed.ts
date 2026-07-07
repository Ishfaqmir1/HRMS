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

  console.log('---------------------------------------------');
  console.log('Seed complete.');
  console.log(`Super Admin login: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`Demo company slug: ${demoCompany.slug}`);
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
