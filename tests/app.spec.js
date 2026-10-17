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

async function changeCardStatus(page, task, nextStatus) {
  const statusSelect = taskCard(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
  await expect(statusSelect).toBeVisible();
  await statusSelect.selectOption(nextStatus);
  return statusSelect;
}

async function expectStoredTaskStatusChange(page, originalTasks, taskId, nextStatus) {
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.map(task => task.id)).toEqual(originalTasks.map(task => task.id));
  const taskIndex = originalTasks.findIndex(task => task.id === taskId);
  const { updatedAt, ...originalFields } = originalTasks[taskIndex];
  expect(saved[taskIndex]).toMatchObject({ ...originalFields, status: nextStatus });
  expect(saved[taskIndex].updatedAt).not.toBe(originalTasks[taskIndex].updatedAt);
}

test('cardStatusSelectHasCurrentValueOptionsAndTaskSpecificName', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'select-todo', title: 'Select Todo', status: 'todo' }),
    makeTask({ id: 'select-doing', title: 'Select Doing', status: 'doing' }),
    makeTask({ id: 'select-done', title: 'Select Done', status: 'done' })
  ];
  await openBoard(page, tasks);

  for (const task of tasks) {
    const statusSelect = taskCard(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
    await expect(statusSelect).toHaveValue(task.status);
    await expect(statusSelect.locator('option')).toHaveText(['Todo', 'Doing', 'Done']);
  }

  await expect(page.locator('.task-badge.status-badge')).toHaveCount(0);
  await expect(taskCard(page, 'Select Todo').getByText('Priority: Medium')).toBeVisible();
});

test('directStatusChangeTodoToDoingPreservesTaskFieldsAndStoredOrder', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'status-before', title: 'Before transition', status: 'doing', priority: 'low' }),
    makeTask({ id: 'status-target', title: 'Todo to Doing', status: 'todo', priority: 'high', dueDate: '2026-11-15' }),
    makeTask({ id: 'status-after', title: 'After transition', status: 'done', description: 'Keep this field' })
  ];
  await openBoard(page, tasks);

  await changeCardStatus(page, tasks[1], 'doing');

  await expect(taskCard(page, tasks[1].title)).toBeVisible();
  await expect(taskCard(page, tasks[1].title).getByRole('combobox', { name: `Status for ${tasks[1].title}` })).toHaveValue('doing');
  await expect(taskCard(page, tasks[1].title).getByText('Priority: High')).toBeVisible();
  await expect(taskCard(page, tasks[1].title)).toContainText('Nov 15, 2026');
  await expect(page.locator('#doing-heading').locator('..').locator('.task-card').filter({
    has: page.getByRole('heading', { name: tasks[1].title, exact: true })
  })).toHaveCount(1);
  await expect(page.locator('#task-status-change-message')).toContainText('saved');
  await expectStoredTaskStatusChange(page, tasks, 'status-target', 'doing');
});

test('directStatusChangeDoingToDonePreservesTaskFieldsAndStoredOrder', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'doing-first', title: 'Doing first', status: 'doing' }),
    makeTask({ id: 'doing-target', title: 'Doing to Done', status: 'doing', description: 'Finish report', priority: 'high' }),
    makeTask({ id: 'doing-last', title: 'Doing last', status: 'todo' })
  ];
  await openBoard(page, tasks);

  await changeCardStatus(page, tasks[1], 'done');

  await expect(page.locator('#done-heading').locator('..').locator('.task-card h4')).toContainText(tasks[1].title);
  await expect(taskCard(page, tasks[1].title)).toContainText('Finish report');
  await expect(taskCard(page, tasks[1].title).getByText('Priority: High')).toBeVisible();
  await expectStoredTaskStatusChange(page, tasks, 'doing-target', 'done');
});

test('directStatusChangeDoneToTodoPreservesTaskFieldsAndStoredOrder', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'done-first', title: 'Done first', status: 'done' }),
    makeTask({ id: 'done-target', title: 'Done to Todo', status: 'done', dueDate: '2026-12-01', priority: 'low' }),
    makeTask({ id: 'done-last', title: 'Done last', status: 'doing' })
  ];
  await openBoard(page, tasks);

  await changeCardStatus(page, tasks[1], 'todo');

  await expect(page.locator('#todo-heading').locator('..').locator('.task-card h4')).toContainText(tasks[1].title);
  await expect(taskCard(page, tasks[1].title)).toContainText('Dec 1, 2026');
  await expect(taskCard(page, tasks[1].title).getByText('Priority: Low')).toBeVisible();
  await expectStoredTaskStatusChange(page, tasks, 'done-target', 'todo');
});

test('directStatusChangePersistsAcrossReload', async ({ page }) => {
  const task = makeTask({ id: 'status-reload', title: 'Persist direct status', status: 'todo' });
  await openBoard(page, [task]);

  await changeCardStatus(page, task, 'doing');
  await page.reload();

  await expect(taskCard(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` })).toHaveValue('doing');
  await expect(page.locator('#doing-heading').locator('..').locator('.task-card h4')).toContainText(task.title);
});

test('statusChangeSaveFailureKeepsSessionStateAndReportsNotSaved', async ({ page }) => {
  const task = makeTask({ id: 'status-save-failure', title: 'Unsaved status update', status: 'todo' });
  await openBoard(page, [task]);
  const savedBefore = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.evaluate(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new DOMException('Storage is full', 'QuotaExceededError');
      return originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);

  await changeCardStatus(page, task, 'doing');

  await expect(taskCard(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` })).toHaveValue('doing');
  await expect(page.locator('#task-status-change-message')).toContainText(/not saved/i);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(savedBefore);
});

test('statusChangePreservesActiveSearchPriorityDueDateAndDueDateSort', async ({ page }) => {
  const dates = await page.evaluate(() => {
    const dateAfter = days => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    return { soon: dateAfter(2), later: dateAfter(5) };
  });
  const tasks = [
    makeTask({ id: 'release-later', title: 'Release followup', status: 'doing', priority: 'high', dueDate: dates.later }),
    makeTask({ id: 'release-target', title: 'Release migration', status: 'todo', priority: 'high', dueDate: dates.soon })
  ];
  await openBoard(page, tasks);
  await page.locator('#task-search').fill('Release');
  await page.locator('#priority-filter').selectOption('high');
  await page.locator('#due-date-filter').selectOption('upcoming');
  await page.locator('#task-sort').selectOption('due-date');

  await changeCardStatus(page, tasks[1], 'doing');

  await expect(page.locator('#task-search')).toHaveValue('Release');
  await expect(page.locator('#status-filter')).toHaveValue('all');
  await expect(page.locator('#priority-filter')).toHaveValue('high');
  await expect(page.locator('#due-date-filter')).toHaveValue('upcoming');
  await expect(page.locator('#task-sort')).toHaveValue('due-date');
  await expect(page.locator('#doing-heading').locator('..').locator('.task-card h4')).toHaveText(['Release migration', 'Release followup']);
  await expectStoredTaskStatusChange(page, tasks, 'release-target', 'doing');
});

test('statusChangePreservesPrioritySortOrder', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'priority-medium', title: 'Priority sort medium', status: 'todo', priority: 'medium' }),
    makeTask({ id: 'priority-high', title: 'Priority sort high', status: 'doing', priority: 'high' })
  ];
  await openBoard(page, tasks);
  await page.locator('#task-sort').selectOption('priority');

  await changeCardStatus(page, tasks[0], 'doing');

  await expect(page.locator('#task-sort')).toHaveValue('priority');
  await expect(page.locator('#doing-heading').locator('..').locator('.task-card h4')).toHaveText(['Priority sort high', 'Priority sort medium']);
  await expectStoredTaskStatusChange(page, tasks, 'priority-medium', 'doing');
});

test('statusChangePreservesDefaultOrderInDestinationColumn', async ({ page }) => {
  const tasks = [
    makeTask({ id: 'default-before', title: 'Default before', status: 'doing' }),
    makeTask({ id: 'default-target', title: 'Default target', status: 'todo' }),
    makeTask({ id: 'default-after', title: 'Default after', status: 'doing' })
  ];
  await openBoard(page, tasks);

  await changeCardStatus(page, tasks[1], 'doing');

  await expect(page.locator('#task-sort')).toHaveValue('default');
  await expect(page.locator('#doing-heading').locator('..').locator('.task-card h4')).toHaveText(['Default before', 'Default target', 'Default after']);
  await expectStoredTaskStatusChange(page, tasks, 'default-target', 'doing');
});

test('statusChangeHidesTaskUnderActiveStatusFilter', async ({ page }) => {
  const task = makeTask({ id: 'status-filter-hide', title: 'Status filter hides task', status: 'todo' });
  await openBoard(page, [task]);
  await page.locator('#status-filter').selectOption('todo');

  await changeCardStatus(page, task, 'doing');

  await expect(page.locator('#status-filter')).toHaveValue('todo');
  await expect(taskCard(page, task.title)).toHaveCount(0);
  await expect(page.locator('#task-status-change-message')).toContainText('hidden by the current filters');
  await expectStoredTaskStatusChange(page, [task], task.id, 'doing');
});

test('statusChangeKeepsCombinedFiltersWhenStatusFilterHidesTask', async ({ page }) => {
  const dates = await page.evaluate(() => {
    const dateAfter = days => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    return { soon: dateAfter(2), later: dateAfter(5) };
  });
  const tasks = [
    makeTask({ id: 'combined-target', title: 'Combined filters target', status: 'todo', priority: 'high', dueDate: dates.soon }),
    makeTask({ id: 'combined-sibling', title: 'Combined filters sibling', status: 'todo', priority: 'high', dueDate: dates.later })
  ];
  await openBoard(page, tasks);
  await page.locator('#task-search').fill('Combined filters');
  await page.locator('#status-filter').selectOption('todo');
  await page.locator('#priority-filter').selectOption('high');
  await page.locator('#due-date-filter').selectOption('upcoming');
  await page.locator('#task-sort').selectOption('due-date');
  await expect(page.locator('#todo-heading').locator('..').locator('.task-card h4')).toHaveText(['Combined filters target', 'Combined filters sibling']);

  await changeCardStatus(page, tasks[0], 'doing');

  await expect(page.locator('#task-search')).toHaveValue('Combined filters');
  await expect(page.locator('#status-filter')).toHaveValue('todo');
  await expect(page.locator('#priority-filter')).toHaveValue('high');
  await expect(page.locator('#due-date-filter')).toHaveValue('upcoming');
  await expect(page.locator('#task-sort')).toHaveValue('due-date');
  await expect(taskCard(page, tasks[0].title)).toHaveCount(0);
  await expect(page.locator('#todo-heading').locator('..').locator('.task-card h4')).toHaveText(['Combined filters sibling']);
  await expect(page.locator('#task-status-change-message')).toContainText('hidden by the current filters');
  await expectStoredTaskStatusChange(page, tasks, tasks[0].id, 'doing');
});

test('statusChangeToDoneHidesTaskUnderDueDateFilter', async ({ page }) => {
  const dueDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const task = makeTask({ id: 'due-filter-hide', title: 'Due filter hides done task', status: 'todo', dueDate });
  await openBoard(page, [task]);
  await page.locator('#due-date-filter').selectOption('upcoming');

  await changeCardStatus(page, task, 'done');

  await expect(page.locator('#due-date-filter')).toHaveValue('upcoming');
  await expect(taskCard(page, task.title)).toHaveCount(0);
  await expect(page.locator('#task-status-change-message')).toContainText('hidden by the current filters');
  await expectStoredTaskStatusChange(page, [task], task.id, 'done');
});

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

test('confirmedDeleteShowsUndoAndKeepsDeleteConfirmation', async ({ page }) => {
  const task = makeTask({ id: 'delete-undo', title: 'Delete with Undo' });
  await openBoard(page, [task]);

  let confirmationMessage = '';
  page.once('dialog', async dialog => {
    confirmationMessage = dialog.message();
    await dialog.accept();
  });
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  expect(confirmationMessage).toContain(task.title);
  expect(confirmationMessage.toLowerCase()).toContain('undo');

  await expect(taskCard(page, task.title)).toHaveCount(0);
  await expect(page.locator('#undo-delete-notice')).toBeVisible();
  await expect(page.getByRole('button', { name: `Undo delete of ${task.title}` })).toBeVisible();
  await expect(page.locator('#undo-delete-message')).toContainText(task.title);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([]);
});

test('cancelledDeletePreservesTaskAndPreviousUndoSnapshot', async ({ page }) => {
  const first = makeTask({ id: 'first-undo', title: 'First deleted task' });
  const second = makeTask({ id: 'second-cancel', title: 'Delete then cancel' });
  await openBoard(page, [first, second]);

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, first.title).getByRole('button', { name: `Delete ${first.title}` }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await taskCard(page, second.title).getByRole('button', { name: `Delete ${second.title}` }).click();

  await expect(taskCard(page, second.title)).toHaveCount(1);
  await expect(page.getByRole('button', { name: `Undo delete of ${first.title}` })).toBeVisible();
  await page.getByRole('button', { name: `Undo delete of ${first.title}` }).click();

  await expect(taskCard(page, first.title)).toHaveCount(1);
  await expect(taskCard(page, second.title)).toHaveCount(1);
  await expect(page.locator('#undo-delete-notice')).toBeVisible();
  await expect(page.getByRole('button', { name: `Undo delete of ${first.title}` })).toBeHidden();
  await expect(page.locator('#undo-delete-message')).toHaveText('Task restored.');
});

test('undoRestoresExactTaskFieldsAndUnderlyingOrder', async ({ page }) => {
  const first = makeTask({ id: 'ordered-first', title: 'First ordered', priority: 'low' });
  const middle = makeTask({ id: 'ordered-middle', title: 'Middle ordered', description: 'Restore every field', status: 'doing', priority: 'high', dueDate: '2026-11-12', createdAt: '2026-02-03T04:05:06.000Z', updatedAt: '2026-03-04T05:06:07.000Z' });
  const last = makeTask({ id: 'ordered-last', title: 'Last ordered', status: 'done' });
  await openBoard(page, [first, middle, last]);

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, middle.title).getByRole('button', { name: `Delete ${middle.title}` }).click();
  await page.getByRole('button', { name: `Undo delete of ${middle.title}` }).click();

  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([first, middle, last]);
  await expect(taskCard(page, middle.title)).toContainText('Restore every field');
  await expect(taskCard(page, middle.title)).toContainText('Doing');
  await expect(taskCard(page, middle.title)).toContainText('Priority: High');
  await expect(taskCard(page, middle.title)).toContainText('Nov 12, 2026');
  await expect(page.locator('#total-task-count')).toHaveText('3');
});

test('secondConfirmedDeleteReplacesVisibleUndoTarget', async ({ page }) => {
  const first = makeTask({ id: 'replace-first', title: 'First removed' });
  const second = makeTask({ id: 'replace-second', title: 'Second removed' });
  await openBoard(page, [first, second]);

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, first.title).getByRole('button', { name: `Delete ${first.title}` }).click();
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, second.title).getByRole('button', { name: `Delete ${second.title}` }).click();

  await expect(page.getByRole('button', { name: `Undo delete of ${second.title}` })).toBeVisible();
  await page.getByRole('button', { name: `Undo delete of ${second.title}` }).click();

  await expect(taskCard(page, first.title)).toHaveCount(0);
  await expect(taskCard(page, second.title)).toHaveCount(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([second]);
});

test('undoButtonHasTaskSpecificAccessibleNameAndLiveMessage', async ({ page }) => {
  const task = makeTask({ id: 'accessible-undo', title: 'Accessible Undo target' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();

  const message = page.locator('#undo-delete-message');
  await expect(page.getByRole('button', { name: `Undo delete of ${task.title}` })).toBeVisible();
  await expect(message).toHaveAttribute('role', 'status');
  await expect(message).toHaveAttribute('aria-live', 'polite');
});

test('deleteSaveFailureKeepsUndoAvailableAndReportsNotSaved', async ({ page }) => {
  const task = makeTask({ id: 'delete-save-failure', title: 'Delete without storage' });
  await openBoard(page, [task]);
  const originalStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.evaluate(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new Error('simulated quota failure');
      return originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();

  await expect(taskCard(page, task.title)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Undo delete of ${task.title}` })).toBeVisible();
  await expect(page.locator('#undo-delete-message')).toContainText(/not saved/i);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(originalStorage);
});

test('undoSaveFailureRestoresInMemoryAndReportsNotSaved', async ({ page }) => {
  const task = makeTask({ id: 'undo-save-failure', title: 'Restore without storage' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  const deletedStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.evaluate(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new Error('simulated quota failure');
      return originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);

  await page.getByRole('button', { name: `Undo delete of ${task.title}` }).click();

  await expect(taskCard(page, task.title)).toHaveCount(1);
  await expect(page.locator('#undo-delete-message')).toContainText(/could not be saved/i);
  await expect(page.locator('#undo-delete-message')).toContainText(/reload/i);
  await expect(page.getByRole('button', { name: `Undo delete of ${task.title}` })).toBeHidden();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(deletedStorage);
});

test('undoPreservesActiveFilterAndSort', async ({ page }) => {
  const first = makeTask({ id: 'view-first', title: 'Sort test later', status: 'todo', priority: 'low', dueDate: '2026-11-20' });
  const target = makeTask({ id: 'view-target', title: 'Sort test target', status: 'todo', priority: 'high', dueDate: '2026-11-11' });
  const last = makeTask({ id: 'view-last', title: 'Sort test middle', status: 'todo', priority: 'medium', dueDate: '2026-11-15' });
  await openBoard(page, [first, target, last]);
  await page.locator('#task-search').fill('Sort test');
  await page.locator('#status-filter').selectOption('todo');
  await page.locator('#task-sort').selectOption('due-date');

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, target.title).getByRole('button', { name: `Delete ${target.title}` }).click();
  await page.getByRole('button', { name: `Undo delete of ${target.title}` }).click();

  await expect(page.locator('#task-search')).toHaveValue('Sort test');
  await expect(page.locator('#status-filter')).toHaveValue('todo');
  await expect(page.locator('#task-sort')).toHaveValue('due-date');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([first, target, last]);
  await expect(page.locator('.task-card h4')).toHaveText([target.title, last.title, first.title]);
});

test('undoKeepsRestoredTaskHiddenWhenItDoesNotMatchFilter', async ({ page }) => {
  const task = makeTask({ id: 'hidden-after-undo', title: 'Hidden until filters clear', status: 'todo' });
  await openBoard(page, [task]);

  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  await page.locator('#status-filter').selectOption('doing');
  await page.getByRole('button', { name: `Undo delete of ${task.title}` }).click();

  await expect(page.locator('#status-filter')).toHaveValue('doing');
  await expect(taskCard(page, task.title)).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([task]);
  await page.locator('#clear-task-filters').click();
  await expect(taskCard(page, task.title)).toHaveCount(1);
});

test('deleteThenReloadDoesNotRetainUndoSnapshot', async ({ page }) => {
  const task = makeTask({ id: 'delete-reload', title: 'Deleted before reload' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  await expect(page.getByRole('button', { name: `Undo delete of ${task.title}` })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('button', { name: /Undo delete/ })).toHaveCount(0);
  await expect(taskCard(page, task.title)).toHaveCount(0);
});

test('undoThenReloadRetainsRestoredTask', async ({ page }) => {
  const task = makeTask({ id: 'undo-reload', title: 'Restored before reload' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  await page.getByRole('button', { name: `Undo delete of ${task.title}` }).click();

  await page.reload();

  await expect(taskCard(page, task.title)).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Undo delete/ })).toHaveCount(0);
});

test('doubleUndoActivationDoesNotDuplicateTask', async ({ page }) => {
  const task = makeTask({ id: 'double-undo', title: 'Undo only once' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await taskCard(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();
  const undoButton = page.getByRole('button', { name: `Undo delete of ${task.title}` });
  await undoButton.click();
  await page.locator('#undo-delete-button').dispatchEvent('click');

  await expect(taskCard(page, task.title)).toHaveCount(1);
  await expect(page.locator('#undo-delete-message')).toHaveText('Undo is no longer available.');
  const storedTasks = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(storedTasks).toEqual([task]);
  expect(new Set(storedTasks.map(savedTask => savedTask.id)).size).toBe(1);
});

test('filtersAndSortComposeWithoutChangingStoredTaskOrder', async ({ page }) => {
  const dates = await page.evaluate(() => {
    const futureDate = days => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    return { soon: futureDate(2), late: futureDate(4), far: futureDate(20) };
  });
  const tasks = [
    makeTask({ id: 'late', title: 'Alpha review late', priority: 'high', dueDate: dates.late }),
    makeTask({ id: 'soon', title: 'Alpha review soon', priority: 'high', dueDate: dates.soon }),
    makeTask({ id: 'search-miss', title: 'Beta review', priority: 'high', dueDate: dates.soon }),
    makeTask({ id: 'status-miss', title: 'Alpha review doing', status: 'doing', priority: 'high', dueDate: dates.soon }),
    makeTask({ id: 'priority-miss', title: 'Alpha review low', priority: 'low', dueDate: dates.soon }),
    makeTask({ id: 'date-miss', title: 'Alpha review far', priority: 'high', dueDate: dates.far }),
    makeTask({ id: 'done', title: 'Alpha review done', status: 'done', priority: 'high', dueDate: dates.soon })
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
  const upcomingDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const tasks = [
    makeTask({ id: 'one', title: 'Alpha', priority: 'high', dueDate: upcomingDate }),
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
