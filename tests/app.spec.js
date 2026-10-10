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

function taskCard(page, title) {
  return page.locator('.task-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

test('createTaskPersistsAllEnteredFieldsAcrossReload', async ({ page }) => {
  await openBoard(page);
  await page.locator('#task-title').fill('Prepare portfolio review');
  await page.locator('#task-description').fill('Collect the project notes');
  await page.locator('#task-status').selectOption('doing');
  await page.locator('#task-priority').selectOption('high');
  await page.locator('#task-due-date').fill('2026-10-30');
  await page.getByRole('button', { name: 'Add task' }).click();

  const card = taskCard(page, 'Prepare portfolio review');
  await expect(card).toContainText('Collect the project notes');
  await expect(card).toContainText('Doing');
  await expect(card).toContainText('Priority: High');
  await expect(card).toContainText('Oct 30, 2026');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ title: 'Prepare portfolio review', description: 'Collect the project notes', status: 'doing', priority: 'high', dueDate: '2026-10-30' });

  await page.reload();
  await expect(taskCard(page, 'Prepare portfolio review')).toBeVisible();
  await expect(page.locator('#total-task-count')).toHaveText('1');
  await expect(page.locator('#in-progress-count')).toHaveText('1');
});

test('editTaskUpdatesTitleDescriptionStatusPriorityAndDueDate', async ({ page }) => {
  const existing = makeTask({ id: 'edit-browser', title: 'Old title', description: 'Old description', dueDate: '2026-10-20' });
  await openBoard(page, [existing]);
  await taskCard(page, 'Old title').getByRole('button', { name: 'Edit Old title' }).click();

  await page.locator('#task-title').fill('Updated review task');
  await page.locator('#task-description').fill('Updated description');
  await page.locator('#task-status').selectOption('doing');
  await page.locator('#task-priority').selectOption('high');
  await page.locator('#task-due-date').fill('2026-10-28');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.locator('#doing-heading').locator('..').locator('.task-card')).toContainText('Updated review task');
  await expect(page.locator('.task-card')).not.toContainText('Old title');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ id: existing.id, title: 'Updated review task', description: 'Updated description', status: 'doing', priority: 'high', dueDate: '2026-10-28', createdAt: existing.createdAt });
});

test('deleteConfirmationDeletesOnlyWhenAccepted', async ({ page }) => {
  const tasks = [makeTask({ id: 'delete-this', title: 'Delete this one' }), makeTask({ id: 'keep-this', title: 'Keep this one' })];
  await openBoard(page, tasks);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, 'Delete this one').getByRole('button', { name: 'Delete Delete this one' }).click();

  await expect(taskCard(page, 'Delete this one')).toHaveCount(0);
  await expect(taskCard(page, 'Keep this one')).toHaveCount(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([tasks[1]]);
});

test('deleteConfirmationDismissLeavesTaskAndStorageUnchanged', async ({ page }) => {
  const task = makeTask({ id: 'keep-after-cancel', title: 'Keep after cancel' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.dismiss());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();

  await expect(taskCard(page, task.title)).toHaveCount(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([task]);
});

test('filtersAndSortComposeWithoutChangingStoredTaskOrder', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'late', title: 'Alpha review late', priority: 'high', dueDate: '2026-10-14' }),
    makeTask({ id: 'soon', title: 'Alpha review soon', priority: 'high', dueDate: '2026-10-12' }),
    makeTask({ id: 'search-miss', title: 'Beta review', priority: 'high', dueDate: '2026-10-12' }),
    makeTask({ id: 'status-miss', title: 'Alpha review doing', status: 'doing', priority: 'high', dueDate: '2026-10-12' }),
    makeTask({ id: 'priority-miss', title: 'Alpha review low', priority: 'low', dueDate: '2026-10-12' }),
    makeTask({ id: 'date-miss', title: 'Alpha review far', priority: 'high', dueDate: '2026-11-20' }),
    makeTask({ id: 'done', title: 'Alpha review done', status: 'done', priority: 'high', dueDate: '2026-10-12' })
  ];
  await openBoard(page, tasks);
  const originalStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);

  await page.getByLabel('Search tasks').fill('Alpha review');
  await page.locator('#status-filter').selectOption('todo');
  await page.locator('#priority-filter').selectOption('high');
  await page.locator('#due-date-filter').selectOption('upcoming');
  await page.locator('#task-sort').selectOption('due-date');

  await expect(page.locator('#todo-heading').locator('..').locator('.task-card h4')).toHaveText(['Alpha review soon', 'Alpha review late']);
  await expect(page.locator('#active-filter-summary')).toContainText('Showing 2 of 7 tasks.');
  await expect(page.locator('#total-task-count')).toHaveText('7');
  await expect(page.locator('#in-progress-count')).toHaveText('1');
  await expect(page.locator('#completed-task-count')).toHaveText('1');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(originalStorage);
});

test('clearFiltersResetsControlsWithoutChangingTasks', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'one', title: 'Alpha', priority: 'high', dueDate: '2026-10-12' }),
    makeTask({ id: 'two', title: 'Beta', status: 'doing', priority: 'low', dueDate: null })
  ];
  await openBoard(page, tasks);
  const originalStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.getByLabel('Search tasks').fill('Alpha');
  await page.locator('#status-filter').selectOption('todo');
  await page.locator('#priority-filter').selectOption('high');
  await page.locator('#due-date-filter').selectOption('upcoming');
  await page.locator('#task-sort').selectOption('priority');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await expect(page.getByLabel('Search tasks')).toHaveValue('');
  await expect(page.locator('#status-filter')).toHaveValue('all');
  await expect(page.locator('#priority-filter')).toHaveValue('all');
  await expect(page.locator('#due-date-filter')).toHaveValue('all');
  await expect(page.locator('#task-sort')).toHaveValue('default');
  await expect(page.locator('.task-card h4')).toHaveText(['Alpha', 'Beta']);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(originalStorage);
});






