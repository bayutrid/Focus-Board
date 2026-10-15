import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { STORAGE_KEY } from '../scripts/storage.js';
import { makeTask } from './support/task-fixtures.js';

async function openBoard(page, tasks = []) {
  await page.addInitScript(({ key, seededTasks }) => {
    if (sessionStorage.getItem('__focusboardTestSeeded') === '1') return;
    localStorage.removeItem(key);
    if (seededTasks.length > 0) localStorage.setItem(key, JSON.stringify(seededTasks));
    sessionStorage.setItem('__focusboardTestSeeded', '1');
  }, { key: STORAGE_KEY, seededTasks: tasks });
  await page.goto('/');
}

function envelope(tasks) {
  return { format: 'focusboard-tasks', version: 1, tasks };
}

async function uploadJson(page, value, name = 'tasks.json') {
  const contents = typeof value === 'string' ? value : JSON.stringify(value);
  await page.locator('#restore-file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents)
  });
}

async function savedTasks(page) {
  return page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
}

test('exportDownloadsAllCanonicalTasksEvenWhenFiltered', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'export-first', title: 'Visible task', extra: 'must not export' }),
    makeTask({ id: 'export-second', title: 'Hidden task', status: 'doing' })
  ];
  await openBoard(page, tasks);
  await page.locator('#task-search').fill('Visible');
  await expect(page.locator('.task-card')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export tasks' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));

  expect(download.suggestedFilename()).toMatch(/^focusboard-tasks-\d{4}-\d{2}-\d{2}\.json$/);
  expect(exported.format).toBe('focusboard-tasks');
  expect(exported.version).toBe(1);
  expect(exported.tasks.map(task => task.id)).toEqual(['export-first', 'export-second']);
  expect(Object.keys(exported.tasks[0])).toEqual(['id', 'title', 'description', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt']);
  expect(exported.tasks[0]).not.toHaveProperty('extra');
  await expect(page.locator('#portability-message')).toHaveText('Tasks exported successfully.');
});

test('validRestoreReplacesTasksAndSurvivesReload', async ({ page }) => {
  const oldTask = makeTask({ id: 'old', title: 'Old task' });
  const restored = [makeTask({ id: 'restored-one', title: 'Restored one' }), makeTask({ id: 'restored-two', title: 'Restored two', status: 'doing' })];
  await openBoard(page, [oldTask]);
  page.once('dialog', dialog => dialog.accept());
  await uploadJson(page, envelope(restored));

  await expect(page.locator('.task-card h4')).toHaveText(['Restored one', 'Restored two']);
  await expect(page.locator('#portability-message')).toHaveText('Tasks restored successfully.');
  expect(JSON.parse(await savedTasks(page))).toEqual(restored);
  await page.reload();
  await expect(page.locator('.task-card h4')).toHaveText(['Restored one', 'Restored two']);
});

test('invalidJsonAndInvalidStructureDoNotChangeTasksOrStorage', async ({ page }) => {
  const current = makeTask({ id: 'current', title: 'Current task' });
  await openBoard(page, [current]);
  const originalStorage = await savedTasks(page);

  await uploadJson(page, '{broken');
  await expect(page.locator('#portability-message')).toContainText('not valid JSON');
  expect(await savedTasks(page)).toBe(originalStorage);
  await expect(page.locator('.task-card h4')).toHaveText(['Current task']);

  await uploadJson(page, { format: 'focusboard-tasks', version: 9, tasks: [] });
  await expect(page.locator('#portability-message')).toContainText('not a supported FocusBoard export');
  expect(await savedTasks(page)).toBe(originalStorage);
  await expect(page.locator('.task-card h4')).toHaveText(['Current task']);
});

test('restoreRejectsInvalidTaskDuplicateIdsAndExtraFields', async ({ page }) => {
  const current = makeTask({ id: 'current', title: 'Current task' });
  const valid = makeTask({ id: 'incoming', title: 'Incoming task' });
  await openBoard(page, [current]);
  const originalStorage = await savedTasks(page);
  const invalidTasks = [
    makeTask({ id: 'bad-status', status: 'blocked' }),
    makeTask({ id: 'bad-date', dueDate: '2026-02-30' }),
    makeTask({ id: 'blank-title', title: '   ' }),
    { ...valid, description: undefined },
    { ...valid, extra: 'not canonical' },
    valid,
    { ...valid }
  ];
  const invalidEnvelopes = invalidTasks.map(task => envelope([task]));
  invalidEnvelopes.push(envelope([valid, { ...valid }]));

  for (const invalidEnvelope of invalidEnvelopes) {
    await uploadJson(page, invalidEnvelope);
    await expect(page.locator('#portability-message')).toContainText('not a supported FocusBoard export');
    expect(await savedTasks(page)).toBe(originalStorage);
    await expect(page.locator('.task-card h4')).toHaveText(['Current task']);
  }
});

test('cancelledRestoreKeepsCurrentTasksAndStorage', async ({ page }) => {
  const current = makeTask({ id: 'keep', title: 'Keep current' });
  await openBoard(page, [current]);
  const originalStorage = await savedTasks(page);
  page.once('dialog', dialog => dialog.dismiss());
  await uploadJson(page, envelope([makeTask({ id: 'new', title: 'New task' })]));

  await expect(page.locator('.task-card h4')).toHaveText(['Keep current']);
  expect(await savedTasks(page)).toBe(originalStorage);
});

test('failedRestorePersistenceKeepsMemoryAndSavedTasksUnchanged', async ({ page }) => {
  const current = makeTask({ id: 'persisted', title: 'Persisted task' });
  const incoming = makeTask({ id: 'incoming', title: 'Incoming task' });
  await openBoard(page, [current]);
  const originalStorage = await savedTasks(page);
  await page.addInitScript(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new Error('simulated quota failure');
      return originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);
  await page.reload();
  page.once('dialog', dialog => dialog.accept());
  await uploadJson(page, envelope([incoming]));

  await expect(page.locator('#portability-message')).toContainText('Restore could not be saved');
  await expect(page.locator('.task-card h4')).toHaveText(['Persisted task']);
  expect(await savedTasks(page)).toBe(originalStorage);
});

test('restoreWhileFilteredResetsViewOnlyAfterSuccessfulReplacement', async ({ page }) => {
  const current = [makeTask({ id: 'visible', title: 'Visible current' }), makeTask({ id: 'hidden', title: 'Hidden current', status: 'doing' })];
  const incoming = [makeTask({ id: 'new', title: 'New restored task' })];
  await openBoard(page, current);
  await page.locator('#task-search').fill('Visible');
  await page.locator('#status-filter').selectOption('todo');
  await page.locator('#priority-filter').selectOption('medium');
  await page.locator('#due-date-filter').selectOption('no-due-date');
  await page.locator('#task-sort').selectOption('priority');
  const originalStorage = await savedTasks(page);

  await uploadJson(page, '{bad');
  await expect(page.locator('#portability-message')).toContainText('not valid JSON');
  await expect(page.locator('#task-search')).toHaveValue('Visible');
  await expect(page.locator('.task-card h4')).toHaveText(['Visible current']);
  expect(await savedTasks(page)).toBe(originalStorage);

  page.once('dialog', dialog => dialog.dismiss());
  await uploadJson(page, envelope(incoming));
  await expect(page.locator('#task-search')).toHaveValue('Visible');
  await expect(page.locator('.task-card h4')).toHaveText(['Visible current']);
  expect(await savedTasks(page)).toBe(originalStorage);

  page.once('dialog', dialog => dialog.accept());
  await uploadJson(page, envelope(incoming));
  await expect(page.locator('#task-search')).toHaveValue('');
  await expect(page.locator('#status-filter')).toHaveValue('all');
  await expect(page.locator('#priority-filter')).toHaveValue('all');
  await expect(page.locator('#due-date-filter')).toHaveValue('all');
  await expect(page.locator('#task-sort')).toHaveValue('default');
  await expect(page.locator('.task-card h4')).toHaveText(['New restored task']);
});

test('successfulRestoreInvalidatesPendingDeleteUndo', async ({ page }) => {
  const deleted = makeTask({ id: 'restore-invalidates', title: 'Deleted before restore' });
  const incoming = makeTask({ id: 'restore-new', title: 'Incoming replacement' });
  await openBoard(page, [deleted]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete ${deleted.title}` }).click();
  await expect(page.getByRole('button', { name: `Undo delete of ${deleted.title}` })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await uploadJson(page, envelope([incoming]));

  await expect(page.locator('#portability-message')).toHaveText('Tasks restored successfully.');
  await expect(page.getByRole('button', { name: /Undo delete/ })).toHaveCount(0);
  await expect(page.locator('#undo-delete-notice')).toBeHidden();
  await expect(page.locator('.task-card h4')).toHaveText([incoming.title]);
});

test('failedOrCancelledRestorePreservesPendingDeleteUndo', async ({ page }) => {
  const deleted = makeTask({ id: 'restore-preserves', title: 'Still undoable after failed restore' });
  const retained = makeTask({ id: 'restore-retained', title: 'Retained task' });
  const incoming = makeTask({ id: 'restore-not-saved', title: 'Unpersisted import' });
  await openBoard(page, [deleted, retained]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete ${deleted.title}` }).click();
  const undoButton = page.getByRole('button', { name: `Undo delete of ${deleted.title}` });

  page.once('dialog', dialog => dialog.dismiss());
  await uploadJson(page, envelope([incoming]));
  await expect(undoButton).toBeVisible();
  await uploadJson(page, '{invalid json');
  await expect(page.locator('#portability-message')).toContainText('not valid JSON');
  await expect(undoButton).toBeVisible();
  const storageAfterDelete = await savedTasks(page);

  await page.evaluate(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new Error('simulated quota failure');
      return originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);
  page.once('dialog', dialog => dialog.accept());
  await uploadJson(page, envelope([incoming]));
  await expect(page.locator('#portability-message')).toContainText('Restore could not be saved');
  await expect(undoButton).toBeVisible();

  await undoButton.click();

  await expect(page.getByRole('heading', { name: deleted.title, exact: true })).toBeVisible();
  await expect(page.locator('#undo-delete-message')).toContainText('could not be saved');
  expect(await savedTasks(page)).toBe(storageAfterDelete);
});

test('exportDoesNotInvalidatePendingDeleteUndo', async ({ page }) => {
  const deleted = makeTask({ id: 'export-keeps-undo', title: 'Undo after export' });
  await openBoard(page, [deleted]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete ${deleted.title}` }).click();
  const undoButton = page.getByRole('button', { name: `Undo delete of ${deleted.title}` });
  await expect(undoButton).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export tasks' }).click();
  await download;
  await expect(undoButton).toBeVisible();
  await undoButton.click();

  await expect(page.getByRole('heading', { name: deleted.title, exact: true })).toBeVisible();
});
