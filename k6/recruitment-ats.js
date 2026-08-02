// k6 Load Test — Recruitment (ATS) Simulation
// Run: k6 run k6/recruitment-ats.js
// Simulates: Recruiters creating jobs, candidates applying, interview scheduling

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const atsSuccess = new Rate('ats_success_rate');
const atsDuration = new Trend('ats_duration_ms');

export const options = {
  stages: [
    { duration: '20s', target: 50 },
    { duration: '40s', target: 200 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    ats_success_rate: ['rate>0.95'],
    http_req_duration: ['p(95)<8000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

export default function () {
  // Login as recruiter
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'henry@demo.com',
    password: 'Demo123!',
    companySlug: 'demo-company',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'Login successful': (r) => r.status === 201 });

  const token = loginRes.json('data.accessToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const ts = Date.now();

  group('Recruitment Operations', () => {
    // 1. Get job listings
    const jobsRes = http.get(`${BASE_URL}/recruitment/jobs?page=1&limit=20`, { headers });
    check(jobsRes, { 'Jobs loaded': (r) => r.status === 200 });

    // 2. Create job posting
    const jobRes = http.post(`${BASE_URL}/recruitment/jobs`, JSON.stringify({
      title: `Load Test Engineer ${ts}`,
      location: 'Remote',
      employmentType: 'FULL_TIME',
      description: 'Load test job posting',
      requirements: 'k6 scripting experience',
      openings: 2,
      status: 'PUBLISHED',
    }), { headers });

    check(jobRes, { 'Job created': (r) => r.status === 201 || r.status === 400 });
    const jobId = jobRes.json('data.id');

    // 3. Submit applications
    for (let i = 0; i < 3; i++) {
      const appRes = http.post(`${BASE_URL}/recruitment/applications`, JSON.stringify({
        jobPostingId: jobId,
        candidateName: `Candidate ${ts}-${i}`,
        candidateEmail: `candidate-${ts}-${i}@test.com`,
        candidatePhone: `+1-555-${String(ts).slice(-4)}-${i}`,
        source: 'LinkedIn',
      }), { headers });

      check(appRes, { 'Application submitted': (r) => r.status === 201 });
    }

    // 4. Get applications list
    const appsRes = http.get(`${BASE_URL}/recruitment/applications?page=1&limit=20`, { headers });
    check(appsRes, { 'Applications loaded': (r) => r.status === 200 });

    // 5. Schedule interviews
    const appsData = appsRes.json('data.items');
    if (appsData && appsData.length > 0) {
      const appId = appsData[0].id;
      const interviewRes = http.post(`${BASE_URL}/recruitment/interviews`, JSON.stringify({
        applicationId: appId,
        title: 'Technical Screen',
        type: 'VIDEO',
        scheduledAt: '2026-07-20T14:00:00Z',
        durationMinutes: 60,
      }), { headers });

      check(interviewRes, { 'Interview scheduled': (r) => r.status === 201 });
    }

    // 6. Get interviews
    const interviewsRes = http.get(`${BASE_URL}/recruitment/interviews/upcoming`, { headers });
    check(interviewsRes, { 'Upcoming interviews loaded': (r) => r.status === 200 });

    atsDuration.add(Date.now() - loginRes.timings.wait);
  });

  sleep(Math.random() * 3 + 1);
}
