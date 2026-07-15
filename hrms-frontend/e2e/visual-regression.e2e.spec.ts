import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.describe.configure({ mode: 'parallel' });

  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Get auth token via API for screenshot tests
    const res = await request.post('http://localhost:3001/api/v1/auth/login', {
      data: {
        email: 'hr@demo.com',
        password: 'Demo123!',
        companySlug: 'demo-company',
      },
    });
    const json = await res.json();
    authToken = json.data.accessToken;
  });

  test('Login page renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });

  test('Dashboard page renders correctly', async ({ page }) => {
    // Login via localStorage injection
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 15000 });
    await expect(page).toHaveScreenshot('dashboard-page.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });

  test('Sidebar navigation renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('nav', { timeout: 15000 });

    // Screenshot just the sidebar area
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toHaveScreenshot('sidebar-navigation.png', {
      maxDiffPixels: 500,
    });
  });

  test('Employees list table renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/employees', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 15000 });
    await expect(page).toHaveScreenshot('employees-list.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });

  test('Attendance page renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/attendance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button:has-text("Clock In")', { timeout: 15000 });
    await expect(page).toHaveScreenshot('attendance-page.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });

  test('ESS attendance calendar renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/ess/attendance', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('button:has-text("PRESENT")', { timeout: 15000 });
    await expect(page).toHaveScreenshot('ess-attendance-calendar.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });

  test('Analytics dashboard renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('hrms_access_token', token);
      localStorage.setItem('hrms_refresh_token', token);
    }, authToken);

    await page.goto('http://localhost:3000/analytics', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.recharts-wrapper', { timeout: 20000 });
    await expect(page).toHaveScreenshot('analytics-dashboard.png', {
      maxDiffPixels: 1000,
      fullPage: true,
    });
  });
});
