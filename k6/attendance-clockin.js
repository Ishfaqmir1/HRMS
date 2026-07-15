// k6 Load Test — Attendance Clock-In Simulation
// Run: k6 run k6/attendance-clockin.js
// Simulates: Employees clocking in at different times with GPS coordinates

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const clockinSuccess = new Rate('clockin_success_rate');
const clockinDuration = new Trend('clockin_duration_ms');
const securityCheckDuration = new Trend('security_check_duration_ms');
const totalRequests = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 500 },     // Ramp to 500 users
    { duration: '2m', target: 1000 },    // Ramp to 1000 users
    { duration: '1m', target: 1000 },    // Stay at 1000
    { duration: '30s', target: 0 },       // Ramp down
  ],
  thresholds: {
    clockin_success_rate: ['rate>0.99'],   // 99%+ success rate
    http_req_duration: ['p(95)<5000'],     // 95% under 5s
    http_req_failed: ['rate<0.01'],        // <1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

// Mock employee credentials dataset
const employees = [
  // Demo company — HR manager
  { email: 'hr@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7749, lng: -122.4194 },
  { email: 'alice@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7750, lng: -122.4195 },
  { email: 'bob@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7748, lng: -122.4193 },
  { email: 'carol@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7751, lng: -122.4196 },
  { email: 'david@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7747, lng: -122.4192 },
  { email: 'eve@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7752, lng: -122.4197 },
  { email: 'frank@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7746, lng: -122.4191 },
  { email: 'grace@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7753, lng: -122.4198 },
  { email: 'henry@demo.com', password: 'Demo123!', companySlug: 'demo-company', lat: 37.7745, lng: -122.4190 },
];

export function setup() {
  // Pre-authenticate all employees and return tokens
  const tokens = [];
  for (const emp of employees) {
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: emp.email,
      password: emp.password,
      companySlug: emp.companySlug,
    }), { headers: { 'Content-Type': 'application/json' } });

    if (loginRes.status === 201) {
      tokens.push({
        token: loginRes.json('data.accessToken'),
        ...emp,
      });
    }
  }
  return { tokens };
}

export default function (data) {
  const { tokens } = data;
  if (!tokens || tokens.length === 0) {
    console.error('No authenticated tokens available');
    return;
  }

  // Pick a random employee from the pool
  const emp = tokens[Math.floor(Math.random() * tokens.length)];
  const headers = {
    'Authorization': `Bearer ${emp.token}`,
    'Content-Type': 'application/json',
  };

  group('Attendance Clock-In', () => {
    // 1. Security check (QR code validation or face verification)
    group('Security Validation', () => {
      const secStart = Date.now();

      // Simulate QR code generation
      const qrRes = http.post(`${BASE_URL}/attendance-security/qr/generate`, JSON.stringify({
        branchId: 'branch-1',
      }), { headers });

      check(qrRes, {
        'QR generation successful': (r) => r.status === 201,
      });

      // Simulate face verification
      const faceRes = http.post(`${BASE_URL}/attendance-security/face/verify`, JSON.stringify({
        faceEncoding: [0.1, 0.2, 0.3, 0.4, 0.5], // mock face encoding
      }), { headers });

      check(faceRes, {
        'Face verification successful': (r) => r.status === 201 || r.status === 403,
      });

      securityCheckDuration.add(Date.now() - secStart);
    });

    // 2. Clock in with GPS coordinates
    const clockinStart = Date.now();
    const clockInRes = http.post(`${BASE_URL}/attendance/clock-in`, JSON.stringify({
      lat: emp.lat + (Math.random() - 0.5) * 0.001,  // slight GPS jitter
      lng: emp.lng + (Math.random() - 0.5) * 0.001,
      locationAccuracy: Math.floor(Math.random() * 20) + 5,  // 5-25m accuracy
      source: 'WEB',
      deviceType: 'desktop',
      userAgent: 'k6-load-test',
    }), { headers });

    clockinDuration.add(Date.now() - clockinStart);
    totalRequests.add(1);

    const isSuccess = check(clockInRes, {
      'Clock-in status is 201': (r) => r.status === 201,
      'Clock-in response has data': (r) => r.json('data') !== undefined,
    });

    clockinSuccess.add(isSuccess);

    if (!isSuccess) {
      console.log(`Clock-in failed for ${emp.email}: ${clockInRes.status} ${clockInRes.body}`);
    }
  });

  // 3. Simulate clock-out after 1-3 hours of work
  sleep(Math.random() * 5 + 2); // Wait 2-7s between clock-in and clock-out

  group('Attendance Clock-Out', () => {
    const clockOutRes = http.post(`${BASE_URL}/attendance/clock-out`, JSON.stringify({
      notes: 'Load test clock-out',
    }), { headers });

    check(clockOutRes, {
      'Clock-out status is 201': (r) => r.status === 201,
      'Worked minutes calculated': (r) => r.json('data.workedMinutes') > 0,
    });
  });

  // Wait before next iteration
  sleep(Math.random() * 3 + 1);
}

export function teardown(data) {
  // Cleanup: logout all users
  if (data?.tokens) {
    for (const emp of data.tokens) {
      http.post(`${BASE_URL}/auth/logout`, JSON.stringify({
        refreshToken: emp.token,
      }), {
        headers: {
          'Authorization': `Bearer ${emp.token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  }
}
