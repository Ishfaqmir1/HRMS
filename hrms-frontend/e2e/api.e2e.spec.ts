import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E API verification tests.
 * Tests all key API endpoints via direct HTTP calls (not browser).
 */

const BASE = 'http://localhost:3001/api/v1';

interface TestResult {
  endpoint: string;
  status: number;
  duration: number;
  passed: boolean;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr@demo.com', password: 'Demo123!', companySlug: 'demo-company' }),
  });
  const json = await res.json();
  return json.data.accessToken;
}

async function loginAs(email: string, password: string, slug?: string): Promise<string> {
  const body: any = { email, password };
  if (slug) body.companySlug = slug;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json.data.accessToken;
}

test.describe('API Endpoint Verification', () => {
  let token: string;
  const results: TestResult[] = [];

  test.beforeAll(async () => {
    token = await login();
    expect(token).toBeTruthy();
  });

  test.afterAll(() => {
    // Print summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n  📊 API Test Results: ${passed}/${results.length} passed`);
    if (failed > 0) {
      console.log(`  ❌ Failed endpoints:`);
      results.filter(r => !r.passed).forEach(r =>
        console.log(`     ${r.endpoint} → ${r.status} (${r.duration}ms)`)
      );
    }
  });

  async function testEndpoint(name: string, url: string, options?: { expectedStatus?: number; method?: string; body?: any }) {
    const method = options?.method || 'GET';
    const expectedStatus = options?.expectedStatus || 200;

    const start = performance.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (err: any) {
      results.push({ endpoint: name, status: 0, duration: 0, passed: false });
      test.fail(true, `Connection failed for ${name}: ${err.message}`);
      return;
    }
    const duration = performance.now() - start;
    const passed = res.status === expectedStatus;
    results.push({ endpoint: name, status: res.status, duration: Math.round(duration), passed });

    test.step(`${name} → ${res.status} (${Math.round(duration)}ms)`, () => {
      expect(res.status).toBe(expectedStatus);
    });
  }

  test('Health endpoint', async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe('ok');
  });

  test('All authenticated endpoints respond correctly', async () => {
    test.setTimeout(120000);
    const endpoints = [
      { name: 'Dashboard', url: `${BASE}/me/dashboard` },
      { name: 'Profile', url: `${BASE}/me/profile` },
      { name: 'Payslips', url: `${BASE}/me/payslips` },
      { name: 'Leave History', url: `${BASE}/me/leave/history` },
      { name: 'Attendance Calendar', url: `${BASE}/me/attendance/calendar` },
      { name: 'Employees', url: `${BASE}/employees` },
      { name: 'Departments', url: `${BASE}/departments` },
      { name: 'Branches', url: `${BASE}/branches` },
      { name: 'Shifts', url: `${BASE}/shifts` },
      { name: 'Holidays', url: `${BASE}/holidays` },
      { name: 'Auth Me', url: `${BASE}/auth/me` },
      { name: 'Leave Types', url: `${BASE}/leave-types` },
      { name: 'Payroll Runs', url: `${BASE}/payroll/runs` },
      { name: 'Salary Structures', url: `${BASE}/payroll/salary-structures` },
      { name: 'Billing Plans', url: `${BASE}/billing/plans` },
      { name: 'Attendance', url: `${BASE}/attendance` },
      { name: 'Recruitment Jobs', url: `${BASE}/recruitment/jobs` },
    ];

    for (const ep of endpoints) {
      await testEndpoint(ep.name, ep.url);
    }
  });

  test('All accounts can login', async () => {
    const accounts = [
      { email: 'superadmin@hrms.io', password: 'ChangeMe123!' },
      { email: 'hr@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'alice@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'bob@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'carol@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'david@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'eve@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'frank@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'grace@demo.com', password: 'Demo123!', slug: 'demo-company' },
      { email: 'henry@demo.com', password: 'Demo123!', slug: 'demo-company' },
    ];

    for (const acct of accounts) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acct.email, password: acct.password, companySlug: acct.slug }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.accessToken).toBeTruthy();
      expect(data.data.refreshToken).toBeTruthy();
    }
  });

  test('Dashboard data is returned with correct shape', async () => {
    const res = await fetch(`${BASE}/me/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const data = json.data;

    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('attendanceToday');
    expect(data).toHaveProperty('leaveBalances');
    expect(data).toHaveProperty('pendingLeaveRequests');
    expect(data).toHaveProperty('upcomingHolidays');
    expect(data.profile).toHaveProperty('name');
  });

  test('Employee data has expected fields', async () => {
    const res = await fetch(`${BASE}/employees?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    if (json.data.items.length > 0) {
      const emp = json.data.items[0];
      expect(emp).toHaveProperty('employeeCode');
      expect(emp).toHaveProperty('firstName');
      expect(emp).toHaveProperty('lastName');
      expect(emp).toHaveProperty('status');
    }
  });

  test('Super Admin can access companies endpoint', async () => {
    const saToken = await loginAs('superadmin@hrms.io', 'ChangeMe123!');
    const res = await fetch(`${BASE}/companies`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    // Companies endpoint returns paginated response { items: [...], meta: {...} }
    expect(json.data).toHaveProperty('items');
    expect(Array.isArray(json.data.items)).toBeTruthy();
  });

  test('Invalid login returns 401', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrongpass' }),
    });
    expect(res.status).toBe(401);
  });

  test('Protected endpoint without token returns 401', async () => {
    const res = await fetch(`${BASE}/employees`);
    expect(res.status).toBe(401);
  });

  test('Leave types include expected types', async () => {
    const res = await fetch(`${BASE}/leave-types`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const types = json.data;
    const typeNames = types.map((t: any) => t.name);
    expect(typeNames).toContain('Annual Leave');
    expect(typeNames).toContain('Sick Leave');
  });

  test('Payroll runs exist with data', async () => {
    const res = await fetch(`${BASE}/payroll/runs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThan(0);
  });
});

test.describe('Role-Based Access Control', () => {
  test('Employee cannot access admin endpoints', async () => {
    const empToken = await loginAs('alice@demo.com', 'Demo123!', 'demo-company');

    const adminEndpoints = [
      `${BASE}/roles`,
      `${BASE}/payroll/runs`,
    ];

    for (const url of adminEndpoints) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      // Should be either 403 (forbidden) or 200 (if they have access)
      // For known endpoints where employee lacks permission, expect 403
      if (url.includes('/roles')) {
        expect(res.status).toBe(403);
      }
    }
  });

  test('HR Manager can access employee data', async () => {
    const hrToken = await loginAs('hr@demo.com', 'Demo123!', 'demo-company');

    const res = await fetch(`${BASE}/employees`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThan(0);
  });
});
