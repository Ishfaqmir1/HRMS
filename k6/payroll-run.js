// k6 Load Test — Payroll Run Simulation
// Run: k6 run k6/payroll-run.js
// Simulates: HR managers running payroll for their companies

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const payrollRunDuration = new Trend('payroll_run_duration_ms');
const payrollSuccess = new Rate('payroll_success_rate');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    payroll_success_rate: ['rate>0.95'],
    http_req_duration: ['p(95)<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export default function () {
  // Login as HR manager
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'hr@demo.com',
    password: 'Demo123!',
    companySlug: 'demo-company',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'Login successful': (r) => r.status === 201 });

  const token = loginRes.json('data.accessToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Payroll Operations', () => {
    // 1. Get salary structures
    const structuresRes = http.get(`${BASE_URL}/payroll/salary-structures?page=1&limit=20`, { headers });
    check(structuresRes, { 'Salary structures loaded': (r) => r.status === 200 });

    // 2. Get employee salaries
    const salariesRes = http.get(`${BASE_URL}/payroll/employee-salaries?page=1&limit=20`, { headers });
    check(salariesRes, { 'Employee salaries loaded': (r) => r.status === 200 });

    // 3. Run payroll
    const period = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`;
    const runStart = Date.now();

    const payrollRes = http.post(`${BASE_URL}/payroll/run`, JSON.stringify({
      period,
    }), { headers });

    payrollRunDuration.add(Date.now() - runStart);

    const isSuccess = check(payrollRes, {
      'Payroll run accepted': (r) => r.status === 201 || r.status === 409, // 409 = already exists
      'Response has data': (r) => r.json('data') !== undefined,
    });

    payrollSuccess.add(isSuccess);

    // 4. Get payslips
    if (payrollRes.status === 201) {
      const payslipsRes = http.get(`${BASE_URL}/payroll/payslips?page=1&limit=20`, { headers });
      check(payslipsRes, { 'Payslips loaded': (r) => r.status === 200 });
    }

    // 5. Get payroll runs history
    const runsRes = http.get(`${BASE_URL}/payroll/runs?page=1&limit=10`, { headers });
    check(runsRes, { 'Payroll runs loaded': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);
}
