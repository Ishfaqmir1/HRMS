import { test, expect } from '@playwright/test';

// Accessibility helper: inject axe-core and run analysis
async function checkAccessibility(page: any, context: string) {
  // Inject axe-core from CDN
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js',
  });

  // Run axe analysis
  const results = await page.evaluate(() => {
    return (window as any).axe.run();
  });

  // Log violations but don't fail — collect for reporting
  if (results.violations.length > 0) {
    console.log(`\n⚠️  Accessibility violations on ${context}:`);
    for (const violation of results.violations) {
      console.log(`  🔴 ${violation.id} — ${violation.help}`);
      console.log(`     Impact: ${violation.impact}`);
      console.log(`     Elements: ${violation.nodes.length}`);
      console.log(`     URL: ${violation.helpUrl}`);
    }
  }

  // Assert no critical/serious violations
  const criticalViolations = results.violations.filter(
    (v: any) => v.impact === 'critical' || v.impact === 'serious'
  );

  expect(criticalViolations.length).toBe(0);
}

test.describe('Accessibility Audit', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Login page has no critical accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await checkAccessibility(page, 'Login page');
  });

  test('Protected dashboard page has no critical violations', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'hr@demo.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.fill('input[name="companySlug"]', 'demo-company');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await checkAccessibility(page, 'Dashboard page');
  });

  test('ESS profile page is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'hr@demo.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.fill('input[name="companySlug"]', 'demo-company');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('http://localhost:3000/ess/profile', { waitUntil: 'networkidle', timeout: 30000 });
    await checkAccessibility(page, 'ESS Profile page');
  });

  test('Employees page is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'hr@demo.com');
    await page.fill('input[name="password"]', 'Demo123!');
    await page.fill('input[name="companySlug"]', 'demo-company');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('http://localhost:3000/employees', { waitUntil: 'networkidle', timeout: 30000 });
    await checkAccessibility(page, 'Employees page');
  });
});
