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

function card(page, title) {
  return page.locator('.task-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

async function activateByKeyboard(locator) {
  await locator.focus();
  await locator.press('Enter');
}

test('createRetainsFormFocus', async ({ page }) => {
  await openBoard(page);
  await page.locator('#task-title').fill('Keyboard created task');
  const submit = page.locator('#task-submit');
  await activateByKeyboard(submit);
  await expect(card(page, 'Keyboard created task')).toHaveCount(1);
  await expect(submit).toBeFocused();
});

test('editActionFocusesTitle', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'edit', title: 'Edit target' })]);
  await activateByKeyboard(card(page, 'Edit target').getByRole('button', { name: 'Edit Edit target' }));
  await expect(page.locator('#task-title')).toBeFocused();
});

test('cancelEditReturnsKeyboardFocusToSameEditTrigger', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'cancel-edit', title: 'Return here' })]);
  const edit = card(page, 'Return here').getByRole('button', { name: 'Edit Return here' });
  await activateByKeyboard(edit);
  await activateByKeyboard(page.locator('#task-cancel'));
  await expect(edit).toBeFocused();
});

test('cancelEditFallsBackToTitleWhenOriginalTriggerIsGone', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'hidden-edit', title: 'Will be hidden' })]);
  await activateByKeyboard(card(page, 'Will be hidden').getByRole('button', { name: 'Edit Will be hidden' }));
  await page.locator('#task-search').fill('not this task');
  await expect(card(page, 'Will be hidden')).toHaveCount(0);
  await activateByKeyboard(page.locator('#task-cancel'));
  await expect(page.locator('#task-title')).toBeFocused();
});

test('saveWithStatusChangeKeepsFocusInFormWhenTaskMovesOrIsFilteredOut', async ({ page }) => {
  const task = makeTask({ id: 'move-filtered', title: 'Move on save', status: 'todo', dueDate: null });
  await openBoard(page, [task]);
  await page.locator('#status-filter').selectOption('todo');
  await activateByKeyboard(card(page, task.title).getByRole('button', { name: `Edit ${task.title}` }));
  await page.locator('#task-status').selectOption('doing');
  await page.locator('#task-title').press('Enter');

  await expect(card(page, task.title)).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector('#task-form').contains(document.activeElement))).toBe(true);
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY))[0].status).toBe('doing');
});

test('deleteKeyboardFocusesNextVisibleTaskEditButton', async ({ page }) => {
  const tasks = [makeTask({ id: 'first', title: 'First task' }), makeTask({ id: 'delete-middle', title: 'Middle task' }), makeTask({ id: 'next', title: 'Next task' })];
  await openBoard(page, tasks);
  const deleteButton = card(page, 'Middle task').getByRole('button', { name: 'Delete Middle task' });
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(deleteButton);
  await expect(card(page, 'Next task').getByRole('button', { name: 'Edit Next task' })).toBeFocused();
});

test('deleteLastVisibleTaskFallsBackToPreviousEditButton', async ({ page }) => {
  const tasks = [makeTask({ id: 'previous', title: 'Previous task' }), makeTask({ id: 'last', title: 'Last task' })];
  await openBoard(page, tasks);
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(card(page, 'Last task').getByRole('button', { name: 'Delete Last task' }));
  await expect(card(page, 'Previous task').getByRole('button', { name: 'Edit Previous task' })).toBeFocused();
});

test('deleteFromOnlyTaskFocusesColumnHeading', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'only', title: 'Only task' })]);
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(card(page, 'Only task').getByRole('button', { name: 'Delete Only task' }));
  await expect(page.locator('#todo-heading')).toBeFocused();
  expect(await page.locator('#todo-heading').getAttribute('tabindex')).toBe('-1');
});

test('cancelDeleteReturnsFocusToDeleteTrigger', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'keep', title: 'Keep task' })]);
  const deleteButton = card(page, 'Keep task').getByRole('button', { name: 'Delete Keep task' });
  page.once('dialog', dialog => dialog.dismiss());
  await activateByKeyboard(deleteButton);
  await expect(deleteButton).toBeFocused();
});

test('filtersAndSortRetainFocusOnTheirControls', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'filter', title: 'Filter task' })]);
  const controls = [
    page.locator('#task-search'),
    page.locator('#status-filter'),
    page.locator('#priority-filter'),
    page.locator('#due-date-filter'),
    page.locator('#task-sort')
  ];
  for (const control of controls) {
    await control.focus();
    if (await control.evaluate(element => element.tagName === 'INPUT')) {
      await control.fill('Filter');
    } else {
      await control.selectOption({ index: 1 });
    }
    await expect(control).toBeFocused();
  }
});

test('clearFiltersRetainsFocusOnClearButton', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'clear', title: 'Clear filters task' })]);
  const clearButton = page.locator('#clear-task-filters');
  await activateByKeyboard(clearButton);
  await expect(clearButton).toBeFocused();
});

test('restoreRetainsFocusOnRestoreControl', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'before', title: 'Before restore' })]);
  const input = page.locator('#restore-file');
  await input.focus();
  page.once('dialog', dialog => dialog.accept());
  await input.setInputFiles({
    name: 'restored.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'focusboard-tasks', version: 1, tasks: [makeTask({ id: 'after', title: 'After restore' })] }))
  });
  await expect(input).toBeFocused();
  await expect(page.locator('#portability-message')).toHaveText('Tasks restored successfully.');
});

test('exportRetainsFocusOnExportButton', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'export', title: 'Export task' })]);
  const button = page.getByRole('button', { name: 'Export tasks' });
  const download = page.waitForEvent('download');
  await activateByKeyboard(button);
  await download;
  await expect(button).toBeFocused();
  await expect(page.locator('#portability-message')).toHaveText('Tasks exported successfully.');
});

test('mouseActionsDoNotForceKeyboardFocusTargets', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'mouse-delete', title: 'Mouse delete' }), makeTask({ id: 'mouse-next', title: 'Mouse next' })]);
  page.once('dialog', dialog => dialog.accept());
  await card(page, 'Mouse delete').getByRole('button', { name: 'Delete Mouse delete' }).click();
  expect(await card(page, 'Mouse next').getByRole('button', { name: 'Edit Mouse next' }).evaluate(element => element === document.activeElement)).toBe(false);
});

test('deleteWithQuotedTaskIdRestoresFocusWithoutSelectorErrors', async ({ page }) => {
  const task = makeTask({ id: 'task-"quoted"[value]', title: 'Quoted ID task' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(card(page, task.title).getByRole('button', { name: `Delete ${task.title}` }));
  await expect(page.locator('#todo-heading')).toBeFocused();
  await expect(card(page, task.title)).toHaveCount(0);
});
test('mouseEditDoesNotForceFocusIntoTitle', async ({ page }) => {
  await openBoard(page, [makeTask({ id: 'mouse-edit', title: 'Mouse edit task' })]);
  const edit = card(page, 'Mouse edit task').getByRole('button', { name: 'Edit Mouse edit task' });
  await edit.click();
  await expect(page.locator('#task-title')).not.toBeFocused();
});

test('keyboardUndoFocusesRestoredTaskEditButton', async ({ page }) => {
  const task = makeTask({ id: 'keyboard-undo', title: 'Keyboard undo target' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(card(page, task.title).getByRole('button', { name: `Delete ${task.title}` }));

  await activateByKeyboard(page.getByRole('button', { name: `Undo delete of ${task.title}` }));

  await expect(card(page, task.title).getByRole('button', { name: `Edit ${task.title}` })).toBeFocused();
});

test('keyboardUndoUsesStatusFallbackWhenRestoredTaskIsFilteredOut', async ({ page }) => {
  const task = makeTask({ id: 'filtered-undo', title: 'Filtered undo target', status: 'todo' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await activateByKeyboard(card(page, task.title).getByRole('button', { name: `Delete ${task.title}` }));
  await page.locator('#status-filter').selectOption('doing');

  await activateByKeyboard(page.getByRole('button', { name: `Undo delete of ${task.title}` }));

  await expect(page.locator('#status-filter')).toHaveValue('doing');
  await expect(card(page, task.title)).toHaveCount(0);
  await expect(page.locator('#undo-delete-message')).toBeFocused();
});

test('mouseUndoDoesNotForceFocus', async ({ page }) => {
  const task = makeTask({ id: 'mouse-undo', title: 'Mouse undo target' });
  await openBoard(page, [task]);
  page.once('dialog', dialog => dialog.accept());
  await card(page, task.title).getByRole('button', { name: `Delete ${task.title}` }).click();

  await page.getByRole('button', { name: `Undo delete of ${task.title}` }).click();

  await expect(card(page, task.title)).toHaveCount(1);
  expect(await card(page, task.title).getByRole('button', { name: `Edit ${task.title}` }).evaluate(element => element === document.activeElement)).toBe(false);
  expect(await page.locator('#undo-delete-message').evaluate(element => element === document.activeElement)).toBe(false);
});

test('keyboardStatusChangeRestoresFocusToUpdatedSelect', async ({ page }) => {
  const task = makeTask({ id: 'keyboard-status', title: 'Keyboard status target', status: 'todo' });
  await openBoard(page, [task]);
  const statusSelect = card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
  await statusSelect.focus();
  await statusSelect.press('ArrowDown');

  const updatedSelect = card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
  await expect(updatedSelect).toHaveValue('doing');
  await expect(updatedSelect).toBeFocused();
});

test('keyboardStatusChangeUsesMessageFallbackWhenFilteredOut', async ({ page }) => {
  const task = makeTask({ id: 'keyboard-status-hidden', title: 'Keyboard status hidden', status: 'todo' });
  await openBoard(page, [task]);
  await page.locator('#status-filter').selectOption('todo');
  const statusSelect = card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
  await statusSelect.focus();
  await statusSelect.press('ArrowDown');

  await expect(page.locator('#status-filter')).toHaveValue('todo');
  await expect(card(page, task.title)).toHaveCount(0);
  await expect(page.locator('#task-status-change-message')).toBeFocused();
  await expect(page.locator('#task-status-change-message')).toContainText(task.title);
  await expect(page.locator('#task-status-change-message')).toContainText('filter');
});

test('pointerStatusChangeDoesNotForceAppFocus', async ({ page }) => {
  const task = makeTask({ id: 'pointer-status', title: 'Pointer status target', status: 'todo' });
  await openBoard(page, [task]);
  const statusSelect = card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` });
  await statusSelect.selectOption('doing');

  await expect(card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` })).toHaveValue('doing');
  await expect(page.locator('#task-status-change-message')).not.toBeFocused();
  await expect(card(page, task.title).getByRole('combobox', { name: `Status for ${task.title}` })).not.toBeFocused();
});
