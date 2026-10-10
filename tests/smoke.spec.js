import { test, expect } from '@playwright/test';

test('appLoadsOverHttpWithoutConsoleErrors', async ({ page }) => {
  const pageErrors = [];
  const responses = new Map();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => responses.set(new URL(response.url()).pathname, response));

  await page.goto('/');

  expect(new URL(page.url()).protocol).toBe('http:');
  await expect(page.getByRole('heading', { name: 'Your focus board' })).toBeVisible();
  await expect.poll(() => responses.get('/scripts/app.js')?.status()).toBe(200);
  await expect.poll(() => responses.get('/styles/main.css')?.status()).toBe(200);
  expect(responses.get('/scripts/app.js').headers()['content-type']).toContain('javascript');
  expect(responses.get('/styles/main.css').headers()['content-type']).toContain('text/css');
  expect(pageErrors).toEqual([]);
});

test('serverReturns404AndRejectsPathsOutsideRoot', async ({ request }) => {
  const missing = await request.get('/missing-file.js');
  expect(missing.status()).toBe(404);

  const traversal = await request.get('/%2e%2e/%2e%2e/package.json');
  expect(traversal.status()).toBe(404);
  expect(await traversal.text()).not.toContain('focusboard');
});
