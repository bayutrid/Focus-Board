import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

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

function rawGet(requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: 4173, path: requestPath }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
  });
}

test('serverReturns404AndRejectsRawTraversalOutsideRoot', async () => {
  const missing = await rawGet('/missing-file.js');
  expect(missing.status).toBe(404);

  const outsideFile = path.join(os.tmpdir(), 'focusboard-outside-' + process.pid + '.js');
  try {
    await fs.writeFile(outsideFile, 'outside-root-secret');
    const relativePath = path.relative(process.cwd(), outsideFile).split(path.sep)
      .map(segment => segment === '..' ? '%2e%2e' : encodeURIComponent(segment)).join('/');
    const traversal = await rawGet('/' + relativePath);
    expect(traversal.status).toBe(404);
    expect(traversal.body).not.toContain('outside-root-secret');
  } finally {
    await fs.rm(outsideFile, { force: true });
  }
});

test('serverRejectsSymlinkTargetsOutsideRoot', async () => {
  const outsideDirectory = path.join(os.tmpdir(), 'focusboard-symlink-target-' + process.pid);
  const linkPath = path.join(process.cwd(), 'tests', '.outside-root-' + process.pid);
  try {
    await fs.mkdir(outsideDirectory, { recursive: true });
    await fs.writeFile(path.join(outsideDirectory, 'secret.js'), 'outside-root-secret');
    try {
      await fs.symlink(outsideDirectory, linkPath, 'junction');
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        test.skip(true, 'This Windows environment does not permit creating test junctions.');
      }
      throw error;
    }
    const response = await rawGet('/tests/' + path.basename(linkPath) + '/secret.js');
    expect(response.status).toBe(404);
    expect(response.body).not.toContain('outside-root-secret');
  } finally {
    await fs.rm(linkPath, { recursive: true, force: true });
    await fs.rm(outsideDirectory, { recursive: true, force: true });
  }
});
