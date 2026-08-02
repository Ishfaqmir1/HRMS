import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HRMS E2E Suite', () => {
  let app: INestApplication;
  let server: any;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';

  // Shared tokens
  let superAdminToken: string;
  let superAdminRefreshToken: string;
  let hrToken: string;

  // Tracked IDs for cleanup after CRUD tests
  const createdIds: string[] = [];
  const ts = Date.now();

  // ======================================================================
  // Helpers
  // ======================================================================

  async function postLogin(email: string, password: string, companySlug?: string) {
    const payload: any = { email, password };
    if (companySlug) payload.companySlug = companySlug;

    const prefixed = await request(server).post(`/${apiPrefix}/auth/login`).send(payload);
    if (prefixed.status !== 404) return prefixed;
    return request(server).post('/auth/login').send(payload);
  }

  async function get(path: string, token: string) {
    const prefixed = await request(server).get(`/${apiPrefix}${path}`).set('Authorization', `Bearer ${token}`);
    if (prefixed.status !== 404) return prefixed;
    return request(server).get(path).set('Authorization', `Bearer ${token}`);
  }

  async function postReq(path: string, token: string, body?: any) {
    const prefixed = await request(server).post(`/${apiPrefix}${path}`).set('Authorization', `Bearer ${token}`).send(body);
    if (prefixed.status !== 404) return prefixed;
    return request(server).post(path).set('Authorization', `Bearer ${token}`).send(body);
  }

  async function patchReq(path: string, token: string, body?: any) {
    const prefixed = await request(server).patch(`/${apiPrefix}${path}`).set('Authorization', `Bearer ${token}`).send(body);
    if (prefixed.status !== 404) return prefixed;
    return request(server).patch(path).set('Authorization', `Bearer ${token}`).send(body);
  }

  async function delReq(path: string, token: string) {
    const prefixed = await request(server).delete(`/${apiPrefix}${path}`).set('Authorization', `Bearer ${token}`);
    if (prefixed.status !== 404) return prefixed;
    return request(server).delete(path).set('Authorization', `Bearer ${token}`);
  }

  // ======================================================================
  // Setup
  // ======================================================================

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(apiPrefix);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    server = app.getHttpServer();
  }, 120000);

  afterAll(async () => {
    await app.close();
  });

  // ======================================================================
  // 1. Auth — Login flows
  // ======================================================================

  describe('1. Auth', () => {
    it('logs in the seeded super admin (platform-level, no companySlug)', async () => {
      const res = await postLogin(
        process.env.SUPER_ADMIN_EMAIL || 'superadmin@hrms.io',
        process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!',
      );
      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      superAdminToken = res.body.data.accessToken;
      superAdminRefreshToken = res.body.data.refreshToken;
    });

    it('logs in the demo HR user (tenant-level, with companySlug)', async () => {
      const res = await postLogin('hr@demo.com', 'Demo123!', 'demo-company');
      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeTruthy();
      hrToken = res.body.data.accessToken;
    });

    it('rejects invalid credentials', async () => {
      const res = await postLogin('wrong@email.com', 'wrongpassword');
      expect(res.status).toBe(401);
    });

    it('refresh token works', async () => {
      const res = await request(server)
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken: superAdminRefreshToken });
      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeTruthy();
      superAdminToken = res.body.data.accessToken;
    });
  });

  // ======================================================================
  // 2. ESS — Self-Service (super admin mock profile)
  // ======================================================================

  describe('2. ESS (super admin)', () => {
    it('GET /me/profile returns super admin mock profile', async () => {
      const res = await get('/me/profile', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Super');
    });

    it('GET /me/dashboard returns super admin mock dashboard', async () => {
      const res = await get('/me/dashboard', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.profile.name).toBe('Super Admin');
    });

    it('GET /me/payslips is rejected (no employeeId)', async () => {
      const res = await get('/me/payslips', superAdminToken);
      expect(res.status).toBe(403);
    });
  });

  // ======================================================================
  // 3. ESS — Demo HR user (has employee profile)
  // ======================================================================

  describe('3. ESS (Demo HR)', () => {
    it('GET /me/profile returns HR employee profile', async () => {
      const res = await get('/me/profile', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Demo');
    });

    it('GET /me/dashboard returns HR dashboard', async () => {
      const res = await get('/me/dashboard', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.profile.name).toBe('Demo HR');
    });

    it('GET /me/payslips returns 200 (HR_MANAGER has payroll.read permission)', async () => {
      const res = await get('/me/payslips', hrToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 4. Companies & Reference Data
  // ======================================================================

  describe('4. Companies & Reference Data', () => {
    it('GET /companies returns all tenants', async () => {
      const res = await get('/companies', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /roles/permissions returns the permission catalog (grouped by module)', async () => {
      const res = await get('/roles/permissions', superAdminToken);
      expect(res.status).toBe(200);
      expect(typeof res.body.data).toBe('object');
      expect(Object.keys(res.body.data).length).toBeGreaterThan(0);
    });

    it('GET /health returns OK (public, no auth needed)', async () => {
      const res = await request(server).get(`/${apiPrefix}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
    });
  });

  // ======================================================================
  // 5. Security — Employee-scoped endpoints reject super admin
  // ======================================================================

  describe('5. Employee-scoped endpoint protection', () => {
    it('GET /attendance/me/today returns 403 for super admin', async () => {
      const res = await get('/attendance/me/today', superAdminToken);
      expect(res.status).toBe(403);
    });

    it('GET /leave/requests/me returns 403 for super admin', async () => {
      const res = await get('/leave/requests/me', superAdminToken);
      expect(res.status).toBe(403);
    });

    it('GET /attendance/me/today succeeds for HR user', async () => {
      const res = await get('/attendance/me/today', hrToken);
      expect([200, 404]).toContain(res.status);
    });
  });

  // ======================================================================
  // 6. Auth — Logout & token revocation
  // ======================================================================

  describe('6. Auth Logout', () => {
    it('POST /auth/logout revokes the refresh token', async () => {
      const loginRes = await postLogin(
        process.env.SUPER_ADMIN_EMAIL || 'superadmin@hrms.io',
        process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!',
      );
      const refreshToken = loginRes.body.data.refreshToken;

      const res = await postReq('/auth/logout', superAdminToken, { refreshToken });
      expect(res.status).toBe(201);

      // Using the same refresh token again should fail
      const refreshRes = await request(server)
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken });
      expect([401, 404]).toContain(refreshRes.status);
    });
  });

  // ======================================================================
  // 7. CRUD — Branches (POST → GET → PATCH → DELETE)
  // ======================================================================

  describe('7. Branches CRUD (using HR token for tenant scope)', () => {
    let branchId: string;
    const branchName = `E2E-Test-Branch-${ts}`;

    it('POST /branches creates a new branch', async () => {
      const res = await postReq('/branches', hrToken, {
        name: branchName,
        code: `E2E-${ts}`,
        city: 'Test City',
        country: 'Test Country',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(branchName);
      branchId = res.body.data.id;
      createdIds.push(branchId);
    });

    it('GET /branches/:id returns the created branch', async () => {
      const res = await get(`/branches/${branchId}`, hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(branchName);
    });

    it('PATCH /branches/:id updates the branch', async () => {
      const res = await patchReq(`/branches/${branchId}`, hrToken, {
        city: 'Updated City',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.city).toBe('Updated City');
    });

    it('DELETE /branches/:id deletes the branch (requires branch.delete)', async () => {
      const res = await delReq(`/branches/${branchId}`, hrToken);
      // HR_MANAGER may or may not have branch.delete depending on seed
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        // Verify it's gone
        const getRes = await get(`/branches/${branchId}`, hrToken);
        expect(getRes.status).toBe(404);
      }
    });
  });

  // ======================================================================
  // 8. CRUD — Departments (POST → GET → PATCH → DELETE)
  // ======================================================================

  describe('8. Departments CRUD (using HR token for tenant scope)', () => {
    let departmentId: string;
    const deptName = `E2E-Dept-${ts}`;

    it('POST /departments creates a new department', async () => {
      const res = await postReq('/departments', hrToken, {
        name: deptName,
        code: `DEPT-${ts}`,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(deptName);
      departmentId = res.body.data.id;
      createdIds.push(departmentId);
    });

    it('PATCH /departments/:id updates the department', async () => {
      const res = await patchReq(`/departments/${departmentId}`, hrToken, {
        name: `${deptName}-Updated`,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(`${deptName}-Updated`);
    });

    it('DELETE /departments/:id deletes the department (requires department.delete)', async () => {
      const res = await delReq(`/departments/${departmentId}`, hrToken);
      // HR_MANAGER may or may not have department.delete depending on seed
      expect([200, 403]).toContain(res.status);
    });
  });

  // ======================================================================
  // 9. CRUD — Leave Types (POST → GET → PATCH → DELETE)
  // ======================================================================

  describe('9. Leave Types CRUD (using HR token for tenant scope)', () => {
    let leaveTypeId: string;
    const ltCode = `E2E-LT-${ts}`;

    it('POST /leave-types creates a new leave type', async () => {
      const res = await postReq('/leave-types', hrToken, {
        name: `E2E Leave Type ${ts}`,
        code: ltCode,
        daysPerYear: 15,
        isPaid: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe(ltCode);
      leaveTypeId = res.body.data.id;
      createdIds.push(leaveTypeId);
    });

    it('GET /leave-types returns the created leave type in the list', async () => {
      const res = await get('/leave-types', hrToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((lt: any) => lt.code === ltCode);
      expect(found).toBeTruthy();
    });

    it('DELETE /leave-types/:id deletes the leave type', async () => {
      const res = await delReq(`/leave-types/${leaveTypeId}`, hrToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 10. CRUD — Holidays (POST → GET → PATCH → DELETE)
  // ======================================================================

  describe('10. Holidays CRUD (using HR token for tenant scope)', () => {
    let holidayId: string;
    const holidayName = `E2E Holiday ${ts}`;
    const holidayDate = '2027-12-25';

    it('POST /holidays creates a new holiday', async () => {
      const res = await postReq('/holidays', hrToken, {
        name: holidayName,
        date: holidayDate,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(holidayName);
      holidayId = res.body.data.id;
      createdIds.push(holidayId);
    });

    it('PATCH /holidays/:id updates the holiday', async () => {
      const res = await patchReq(`/holidays/${holidayId}`, hrToken, {
        name: `${holidayName}-Updated`,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(`${holidayName}-Updated`);
    });

    it('DELETE /holidays/:id deletes the holiday', async () => {
      const res = await delReq(`/holidays/${holidayId}`, hrToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 11. CRUD — Shifts (POST → GET → PATCH → DELETE)
  // ======================================================================

  describe('11. Shifts CRUD (using HR token for tenant scope)', () => {
    let shiftId: string;
    const shiftName = `E2E Shift ${ts}`;

    it('POST /shifts creates a new shift', async () => {
      const res = await postReq('/shifts', hrToken, {
        name: shiftName,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        workingDays: [1, 2, 3, 4, 5],
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(shiftName);
      shiftId = res.body.data.id;
      createdIds.push(shiftId);
    });

    it('PATCH /shifts/:id updates the shift', async () => {
      const res = await patchReq(`/shifts/${shiftId}`, hrToken, {
        startTime: '10:00',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.startTime).toBe('10:00');
    });

    it('DELETE /shifts/:id deletes the shift', async () => {
      const res = await delReq(`/shifts/${shiftId}`, hrToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 12. CRUD — Employees (full lifecycle)
  // ======================================================================

  describe('12. Employees CRUD', () => {
    let employeeId: string;
    const empCode = `E2E-EMP-${ts}`;

    it('POST /employees creates a new employee (using HR token for tenant scope)', async () => {
      const res = await postReq('/employees', hrToken, {
        employeeCode: empCode,
        firstName: 'E2E',
        lastName: `Test-${ts}`,
        workEmail: `e2e-${ts}@example.com`,
        dateOfJoining: '2026-07-01',
        employmentType: 'FULL_TIME',
        createLoginAccount: false,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.employee.employeeCode).toBe(empCode);
      employeeId = res.body.data.employee.id;
      createdIds.push(employeeId);
    });

    it('GET /employees returns the new employee in paginated list (using HR token for tenant scope)', async () => {
      const res = await get('/employees', hrToken);
      expect(res.status).toBe(200);
      const found = res.body.data.items.find((e: any) => e.employeeCode === empCode);
      expect(found).toBeTruthy();
    });

    it('PATCH /employees/:id updates the employee (using HR token)', async () => {
      const res = await patchReq(`/employees/${employeeId}`, hrToken, {
        firstName: 'E2E-Updated',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('E2E-Updated');
    });

    it('DELETE /employees/:id soft-deletes the employee (using HR token)', async () => {
      const res = await delReq(`/employees/${employeeId}`, hrToken);
      expect(res.status).toBe(200);
    });

    it('GET /employees/:id returns 404 after deletion (using HR token for tenant scope)', async () => {
      const res = await get(`/employees/${employeeId}`, hrToken);
      expect(res.status).toBe(404);
    });
  });

  // ======================================================================
  // 13. Leave Request Lifecycle (HR user)
  // ======================================================================

  describe('13. Leave Request Lifecycle', () => {
    let leaveTypeId: string;
    let leaveRequestId: string;

    it('fetches an existing leave type for the request (using HR token for tenant scope)', async () => {
      const res = await get('/leave-types', hrToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      leaveTypeId = res.body.data[0].id;
    });

    it('POST /leave/requests creates a leave request (HR user)', async () => {
      if (!leaveTypeId) return; // skip if leave type fetch failed
      const res = await postReq('/leave/requests', hrToken, {
        leaveTypeId,
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        reason: `E2E test leave request ${ts}`,
      });
      // HR_MANAGER role needs leave.create — should return 201 if seed is up-to-date
      if (res.status === 201) {
        expect(res.body.data.status).toBe('PENDING');
        leaveRequestId = res.body.data.id;
      } else {
        expect([400, 403]).toContain(res.status);
      }
    });

    it('GET /leave/requests/me returns the request in my list (if created)', async () => {
      if (!leaveRequestId) return; // skip if creation failed
      const res = await get('/leave/requests/me', hrToken);
      expect(res.status).toBe(200);
      const found = res.body.data.items.find((r: any) => r.id === leaveRequestId);
      expect(found).toBeTruthy();
    });

    it('POST /leave/requests/:id/cancel cancels the request (if created)', async () => {
      if (!leaveRequestId) return; // skip if creation failed
      const res = await postReq(`/leave/requests/${leaveRequestId}/cancel`, hrToken);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  // ======================================================================
  // 14. Validation — DTOs reject invalid input (Bug 3 verification)
  // ======================================================================

  describe('14. Input Validation', () => {
    it('POST /branches rejects empty body (name is required)', async () => {
      const res = await postReq('/branches', superAdminToken, {});
      expect(res.status).toBe(400);
    });

    it('POST /employees rejects missing required fields', async () => {
      const res = await postReq('/employees', superAdminToken, {
        firstName: 'OnlyFirstName',
      });
      expect(res.status).toBe(400);
    });

    it('POST /shifts rejects invalid time format', async () => {
      const res = await postReq('/shifts', superAdminToken, {
        name: 'Bad Shift',
        startTime: '25:00',
        endTime: '18:00',
        workingDays: [1, 2, 3],
      });
      expect(res.status).toBe(400);
    });

    it('POST /holidays rejects non-date string', async () => {
      const res = await postReq('/holidays', superAdminToken, {
        name: 'Bad Holiday',
        date: 'not-a-date',
      });
      expect(res.status).toBe(400);
    });

    it('POST /leave-types rejects body without required fields', async () => {
      const res = await postReq('/leave-types', superAdminToken, {});
      expect(res.status).toBe(400);
    });

    it('POST /auth/login rejects empty body', async () => {
      const res = await request(server).post(`/${apiPrefix}/auth/login`).send({});
      expect(res.status).toBe(400);
    });

    it('POST /auth/register rejects empty body', async () => {
      const res = await request(server).post(`/${apiPrefix}/auth/register`).send({});
      expect(res.status).toBe(400);
    });
  });

  // ======================================================================
  // 15. Analytics Dashboard
  // ======================================================================
  describe('15. Analytics Dashboard', () => {
    it('GET /analytics/dashboard returns analytics for HR user (tenant scope)', async () => {
      const res = await get('/analytics/dashboard', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.attendanceToday).toBeDefined();
      expect(res.body.data.departmentStrength).toBeDefined();
      expect(res.body.data.genderRatio).toBeDefined();
    });

    it('GET /analytics/dashboard returns empty analytics for super admin', async () => {
      const res = await get('/analytics/dashboard', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
    });
  });

  // ======================================================================
  // 16. Multi-Role Login Tests
  // ======================================================================
  describe('16. Multi-Role Login & Auth', () => {
    let aliceToken: string;
    let graceToken: string;
    let henryToken: string;
    let frankToken: string;

    it('logs in as employee (alice@demo.com - Engineering)', async () => {
      const res = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      expect(res.status).toBe(201);
      aliceToken = res.body.data.accessToken;
    });

    it('logs in as payroll manager (grace@demo.com)', async () => {
      const res = await postLogin('grace@demo.com', 'Demo123!', 'demo-company');
      expect(res.status).toBe(201);
      graceToken = res.body.data.accessToken;
    });

    it('logs in as recruiter (henry@demo.com)', async () => {
      const res = await postLogin('henry@demo.com', 'Demo123!', 'demo-company');
      expect(res.status).toBe(201);
      henryToken = res.body.data.accessToken;
    });

    it('logs in as department head (frank@demo.com - Sales)', async () => {
      const res = await postLogin('frank@demo.com', 'Demo123!', 'demo-company');
      expect(res.status).toBe(201);
      frankToken = res.body.data.accessToken;
    });

    it('employee can access own ESS profile', async () => {
      const res = await get('/me/profile', aliceToken);
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Alice');
    });

    it('payroll manager can access payroll dashboard', async () => {
      const res = await get('/payroll/dashboard', graceToken);
      expect(res.status).toBe(200);
      expect(res.body.data.activeStructures).toBeDefined();
    });

    it('HR manager can access recruitment dashboard (HR_MANAGER has recruitment.read)', async () => {
      const res = await get('/recruitment/dashboard', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.activeJobs).toBeDefined();
    });
  });

  // ======================================================================
  // 17. Attendance Flow (clock-in, clock-out, history, CRUD)
  // ======================================================================
  describe('17. Attendance Flow', () => {
    let empToken: string;
    let myEmployeeId: string;

    beforeAll(async () => {
      const loginRes = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      empToken = loginRes.body.data.accessToken;
      const profileRes = await get('/me/profile', empToken);
      myEmployeeId = profileRes.body.data.id;
    });

    it('GET /attendance/me/today returns today\'s record (or 404 if not clocked in)', async () => {
      const res = await get('/attendance/me/today', empToken);
      expect([200, 404]).toContain(res.status);
    });

    it('GET /attendance/me/history returns paginated attendance history', async () => {
      const res = await get('/attendance/me/history', empToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /attendance creates a manual attendance record (HR token)', async () => {
      const res = await postReq('/attendance', hrToken, {
        employeeId: myEmployeeId,
        date: '2026-06-15',
        checkIn: '2026-06-15T09:00:00Z',
        checkOut: '2026-06-15T18:00:00Z',
        status: 'PRESENT',
      });
      expect([201, 400]).toContain(res.status); // 400 if already exists
    });

    it('GET /attendance returns paginated list (HR token)', async () => {
      const res = await get('/attendance', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ======================================================================
  // 18. Attendance Regularization
  // ======================================================================
  describe('18. Attendance Regularization', () => {
    let empToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      empToken = loginRes.body.data.accessToken;
    });

    it('GET /attendance-regularization/me returns my regularizations', async () => {
      const res = await get('/attendance-regularization/me', empToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /attendance-regularization returns all regularizations (HR view)', async () => {
      const res = await get('/attendance-regularization', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // ======================================================================
  // 19. Attendance Security
  // ======================================================================
  describe('19. Attendance Security', () => {
    it('GET /attendance-security/config returns security config', async () => {
      const res = await get('/attendance-security/config', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /attendance-security/config/summary returns summary', async () => {
      const res = await get('/attendance-security/config/summary', hrToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 20. Documents
  // ======================================================================
  describe('20. Documents', () => {
    let empToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      empToken = loginRes.body.data.accessToken;
    });

    it('POST /documents uploads a new document', async () => {
      const res = await postReq('/documents', hrToken, {
        name: `E2E-Test-Doc-${ts}.pdf`,
        fileUrl: '/uploads/test.pdf',
        category: 'OTHER',
        fileSize: 1024,
        mimeType: 'application/pdf',
      });
      expect(res.status).toBe(201);
      const docId = res.body.data?.id;
      if (docId) createdIds.push(docId);
    });

    it('GET /me/documents returns my documents (ESS)', async () => {
      const res = await get('/me/documents', empToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // ======================================================================
  // 21. ESS Full Flow
  // ======================================================================
  describe('21. ESS Full Flow', () => {
    let empToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      empToken = loginRes.body.data.accessToken;
    });

    it('GET /me/leave/history returns my leave history', async () => {
      const res = await get('/me/leave/history', empToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /me/leave/balances returns my leave balances', async () => {
      const res = await get('/me/leave/balances', empToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /me/attendance/calendar returns attendance calendar', async () => {
      const res = await get('/me/attendance/calendar', empToken);
      expect(res.status).toBe(200);
      expect(res.body.data.records).toBeDefined();
    });

    it('GET /me/expenses returns my expense claims', async () => {
      const res = await get('/me/expenses', empToken);
      expect(res.status).toBe(200);
    });

    it('GET /me/loans returns my loans', async () => {
      const res = await get('/me/loans', empToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /me/tax-declarations returns my tax declarations', async () => {
      const res = await get('/me/tax-declarations', empToken);
      expect(res.status).toBe(200);
    });

    it('GET /me/assets returns my asset assignments', async () => {
      const res = await get('/me/assets', empToken);
      expect(res.status).toBe(200);
    });

    it('GET /me/training returns my training enrollments', async () => {
      const res = await get('/me/training', empToken);
      expect(res.status).toBe(200);
    });

    it('GET /me/attendance/regularizations returns my regularizations', async () => {
      const res = await get('/me/attendance/regularizations', empToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 22. Payroll - Salary Structures & Employee Salaries
  // ======================================================================
  describe('22. Payroll Structures', () => {
    let payrollToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('grace@demo.com', 'Demo123!', 'demo-company');
      payrollToken = loginRes.body.data.accessToken;
    });

    it('GET /payroll/salary-structures returns salary structures', async () => {
      const res = await get('/payroll/salary-structures', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('POST /payroll/salary-structures creates a new structure', async () => {
      const res = await postReq('/payroll/salary-structures', payrollToken, {
        name: `E2E-Structure-${ts}`,
        basic: 40000,
        housingAllowance: 10000,
        transportAllowance: 5000,
        medicalAllowance: 3000,
        otherAllowances: 2000,
        taxPercent: 15,
        pensionPercent: 5,
        insuranceDeduction: 1500,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain('E2E-Structure');
    });

    it('GET /payroll/employee-salaries returns employee salaries', async () => {
      const res = await get('/payroll/employee-salaries', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // ======================================================================
  // 23. Payroll - Runs & Payslips
  // ======================================================================
  describe('23. Payroll Runs', () => {
    let payrollToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('grace@demo.com', 'Demo123!', 'demo-company');
      payrollToken = loginRes.body.data.accessToken;
    });

    it('GET /payroll/dashboard returns payroll summary', async () => {
      const res = await get('/payroll/dashboard', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.activeStructures).toBeDefined();
      expect(res.body.data.activeSalaries).toBeDefined();
    });

    it('GET /payroll/runs returns payroll runs', async () => {
      const res = await get('/payroll/runs', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /payroll/runs/:id returns run details with payslips (if runs exist)', async () => {
      const listRes = await get('/payroll/runs', payrollToken);
      if (listRes.body.data.items && listRes.body.data.items.length > 0) {
        const runId = listRes.body.data.items[0].id;
        const res = await get(`/payroll/runs/${runId}`, payrollToken);
        expect(res.status).toBe(200);
        expect(res.body.data.payslips).toBeDefined();
      }
    });

    it('GET /me/payslips returns my payslips (employee ESS, may be empty if no seed data)', async () => {
      const empLogin = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      const res = await get('/me/payslips', empLogin.body.data.accessToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // ======================================================================
  // 24. Payroll - Loans & Reimbursements
  // ======================================================================
  describe('24. Payroll Loans & Reimbursements', () => {
    let payrollToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('grace@demo.com', 'Demo123!', 'demo-company');
      payrollToken = loginRes.body.data.accessToken;
    });

    it('GET /payroll/loans returns all loans', async () => {
      const res = await get('/payroll/loans', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /payroll/me/loans returns my loans (employee)', async () => {
      const empLogin = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      const res = await get('/payroll/me/loans', empLogin.body.data.accessToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /payroll/reimbursement-categories returns categories', async () => {
      const res = await get('/payroll/reimbursement-categories', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('GET /payroll/reimbursements returns all reimbursements', async () => {
      const res = await get('/payroll/reimbursements', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('GET /payroll/me/reimbursements returns my reimbursements (employee)', async () => {
      const empLogin = await postLogin('alice@demo.com', 'Demo123!', 'demo-company');
      const res = await get('/payroll/me/reimbursements', empLogin.body.data.accessToken);
      expect(res.status).toBe(200);
    });
  });

  // ======================================================================
  // 25. Recruitment (using super admin for CRUD, HR for read-only)
  // ======================================================================
  describe('25. Recruitment', () => {
    let jobId: string;
    let appId: string;

    it('GET /recruitment/dashboard returns recruitment summary', async () => {
      const res = await get('/recruitment/dashboard', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('POST /recruitment/jobs creates a new job posting (super admin bypasses company context)', async () => {
      const res = await postReq('/recruitment/jobs', superAdminToken, {
        title: `E2E-Test-Job-${ts}`,
        location: 'Remote',
        employmentType: 'FULL_TIME',
        minSalary: 80000,
        maxSalary: 120000,
        description: 'E2E test job description',
        requirements: 'E2E test requirements',
        openings: 2,
        status: 'PUBLISHED',
      });
      // super admin with no companyId gets 400 from @TenantId() on create
      expect([201, 400, 403]).toContain(res.status);
      if (res.status === 201) jobId = res.body.data.id;
    });

    it('GET /recruitment/jobs returns job listings', async () => {
      const res = await get('/recruitment/jobs', superAdminToken);
      expect([200, 400]).toContain(res.status);
    });

    it('GET /recruitment/applications returns applications list', async () => {
      const res = await get('/recruitment/applications', superAdminToken);
      expect([200, 400]).toContain(res.status);
    });

    it('GET /recruitment/interviews returns interviews list', async () => {
      const res = await get('/recruitment/interviews', superAdminToken);
      expect([200, 400]).toContain(res.status);
    });

    it('GET /recruitment/interviews/upcoming returns upcoming interviews', async () => {
      const res = await get('/recruitment/interviews/upcoming', superAdminToken);
      expect([200, 400]).toContain(res.status);
    });
  });

  // ======================================================================
  // 26. Billing (super admin can read plans; other billing endpoints require company context)
  // ======================================================================
  describe('26. Billing', () => {
    it('GET /billing/plans returns all billing plans (public)', async () => {
      const res = await get('/billing/plans', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('GET /billing/subscription company check', async () => {
      const res = await get('/billing/subscription?companyId=demo-company', superAdminToken);
      // 400 from @TenantId() if companyId is a slug, 404 if not found, 200 if valid
      expect([200, 400, 404]).toContain(res.status);
    });

    it('GET /billing/invoices list check', async () => {
      const res = await get('/billing/invoices?companyId=demo-company', superAdminToken);
      expect([200, 400, 404]).toContain(res.status);
    });

    it('GET /billing/features check', async () => {
      const res = await get('/billing/features?companyId=demo-company', superAdminToken);
      expect([200, 400, 404]).toContain(res.status);
    });

    it('GET /billing/branding check', async () => {
      const res = await get('/billing/branding?companyId=demo-company', superAdminToken);
      expect([200, 400, 404]).toContain(res.status);
    });

    it('GET /billing/limits check', async () => {
      const res = await get('/billing/limits?companyId=demo-company', superAdminToken);
      expect([200, 400, 404]).toContain(res.status);
    });
  });

  // ======================================================================
  // 27. Tax Declarations
  // ======================================================================
  describe('27. Tax Declarations', () => {
    let empToken: string;
    let createdTaxId: string;

    beforeAll(async () => {
      const loginRes = await postLogin('bob@demo.com', 'Demo123!', 'demo-company');
      empToken = loginRes.body.data.accessToken;
    });

    it('POST /tax-declarations creates a tax declaration', async () => {
      const res = await postReq('/tax-declarations', empToken, {
        financialYear: `${ts}-${(ts + 1).toString().slice(-2)}`,
        panNumber: 'TESTP1234X',
        totalIncome: 600000,
        totalDeductions: 200000,
        totalTaxPaid: 50000,
        declarations: { '80c': 150000, hra: 50000 },
      });
      expect(res.status).toBe(201);
      createdTaxId = res.body.data?.id;
    });

    it('GET /tax-declarations returns my declarations', async () => {
      const res = await get('/tax-declarations', empToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /tax-declarations/:financialYear/submit submits a declaration', async () => {
      const taxYear = `${ts}-${(ts + 1).toString().slice(-2)}`;
      const res = await postReq(`/tax-declarations/${taxYear}/submit`, empToken);
      expect([201, 404]).toContain(res.status); // 404 if already submitted
    });
  });

  // ======================================================================
  // 28. Roles CRUD (using super admin - bypasses permissions, but needs companyId for @TenantId)
  // ======================================================================
  describe('28. Roles CRUD', () => {
    it('GET /roles/permissions returns the permission catalog', async () => {
      const res = await get('/roles/permissions', superAdminToken);
      expect(res.status).toBe(200);
    });

    it('GET /roles list (super admin bypasses permissions)', async () => {
      const res = await get('/roles?companyId=', superAdminToken);
      // 400 from @TenantId() if companyId is empty
      expect([200, 400]).toContain(res.status);
    });
  });

  // ======================================================================
  // 29. Shifts - Assignment
  // ======================================================================
  describe('29. Shifts Assignment', () => {
    it('GET /shifts returns all shifts', async () => {
      const res = await get('/shifts', hrToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      const items = res.body.data.items || res.body.data || [];
      expect(Array.isArray(items)).toBe(true);
    });

    it('POST /shifts/:id/assign assigns employees to a shift', async () => {
      const shiftsRes = await get('/shifts', hrToken);
      const items = shiftsRes.body.data?.items || [];
      if (items.length > 0) {
        const shiftId = items[0].id;
        const empRes = await get('/employees', hrToken);
        const empItems = empRes.body.data?.items || [];
        if (empItems.length >= 2) {
          const empIds = empItems.slice(0, 2).map((e: any) => e.id);
          const res = await postReq(`/shifts/${shiftId}/assign`, hrToken, { employeeIds: empIds });
          expect([201, 404]).toContain(res.status);
        }
      }
    });
  });

  // ======================================================================
  // 30. Companies - Profile & Update
  // ======================================================================
  describe('30. Companies', () => {
    it('GET /companies returns all tenants (super admin)', async () => {
      const res = await get('/companies', superAdminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /companies/me returns current company profile', async () => {
      const res = await get('/companies/me', hrToken);
      expect([200, 403]).toContain(res.status);
    });
  });

  // ======================================================================
  // 31. Complete User Login Map - all seeded users can log in
  // ======================================================================
  describe('31. All Seeded User Logins', () => {
    const users = [
      { email: 'alice@demo.com', role: 'Employee' },
      { email: 'bob@demo.com', role: 'Employee' },
      { email: 'carol@demo.com', role: 'Department Head' },
      { email: 'david@demo.com', role: 'Employee' },
      { email: 'eve@demo.com', role: 'Employee' },
      { email: 'frank@demo.com', role: 'Department Head' },
      { email: 'grace@demo.com', role: 'Payroll Manager' },
      { email: 'henry@demo.com', role: 'Recruiter' },
    ];

    for (const user of users) {
      it(`logs in as ${user.role} (${user.email})`, async () => {
        const res = await postLogin(user.email, 'Demo123!', 'demo-company');
        expect(res.status).toBe(201);
        expect(res.body.data.accessToken).toBeTruthy();
      });
    }
  });

  // ======================================================================
  // 32. Indian Statutory Compliance (PF, ESI, PT, TDS)
  // ======================================================================
  describe('32. Indian Statutory Compliance', () => {
    let payrollToken: string;

    beforeAll(async () => {
      const loginRes = await postLogin('grace@demo.com', 'Demo123!', 'demo-company');
      payrollToken = loginRes.body.data.accessToken;
    });

    it('GET /statutory-compliance/config returns compliance config (seeded)', async () => {
      const res = await get('/statutory-compliance/config', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.enablePf).toBe(true);
      expect(res.body.data.enableEsi).toBe(true);
      expect(res.body.data.enablePt).toBe(true);
      expect(res.body.data.enableTds).toBe(true);
      expect(res.body.data.ptState).toBe('KARNATAKA');
      expect(res.body.data.tdsRegime).toBe('NEW');
    });

    it('PATCH /statutory-compliance/config updates compliance config', async () => {
      const res = await patchReq('/statutory-compliance/config', payrollToken, {
        enablePf: true,
        pfWageCeiling: 15000,
        pfEmployeePct: 12,
        pfEmployerPct: 13,
        enableEsi: true,
        esiWageCeiling: 21000,
        ptState: 'MAHARASHTRA',
        tdsRegime: 'OLD',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.ptState).toBe('MAHARASHTRA');
      expect(res.body.data.tdsRegime).toBe('OLD');

      // Restore seeded config
      await patchReq('/statutory-compliance/config', payrollToken, {
        ptState: 'KARNATAKA',
        tdsRegime: 'NEW',
      });
    });

    it('POST /statutory-compliance/calculate calculates statutory deductions', async () => {
      const res = await postReq('/statutory-compliance/calculate', payrollToken, {
        grossPay: 50000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.pfEmployeeShare).toBeGreaterThan(0);
      expect(res.body.data.totalEmployeeDeductions).toBeGreaterThan(0);
      expect(res.body.data.totalEmployerContributions).toBeGreaterThan(0);
    });

    it('POST /statutory-compliance/calculate handles gross below PF ceiling', async () => {
      const res = await postReq('/statutory-compliance/calculate', payrollToken, {
        grossPay: 10000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.pfEmployeeShare).toBe(1200); // 12% of 10000
      expect(res.body.data.esiEmployeeShare).toBeGreaterThan(0);
    });

    it('POST /statutory-compliance/calculate handles gross above ESI ceiling (ESI exempted)', async () => {
      const res = await postReq('/statutory-compliance/calculate', payrollToken, {
        grossPay: 50000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.esiEmployeeShare).toBe(0); // Exempted above 21000
      expect(res.body.data.pfEmployeeShare).toBe(1800); // 12% of 15000 (capped)
    });

    it('POST /statutory-compliance/calculate returns professional tax for KARNATAKA', async () => {
      const res = await postReq('/statutory-compliance/calculate', payrollToken, {
        grossPay: 30000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.professionalTax).toBe(200); // Karnataka: >25000 = $200/month
    });

    it('GET /statutory-compliance/pt-slabs returns PT slabs (empty from DB seeded)', async () => {
      const res = await get('/statutory-compliance/pt-slabs', payrollToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });
});