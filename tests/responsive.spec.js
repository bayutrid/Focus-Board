import { expect, test } from '@playwright/test';
import { STORAGE_KEY } from '../scripts/storage.js';
import { makeTask } from './support/task-fixtures.js';

async function openSeededBoard(page, viewport) {
  await page.setViewportSize(viewport);
  const tasks = [
    makeTask({ id: 'responsive-todo', title: 'Prepare a clear responsive task title', description: 'A representative description that can wrap across multiple lines without forcing the task card beyond its column.', dueDate: null }),
    makeTask({ id: 'responsive-doing', title: 'Review current implementation', status: 'doing', description: 'Check that a task card remains inside its column when the viewport becomes narrow.' }),
    makeTask({ id: 'responsive-done', title: 'Confirm the final layout', status: 'done', description: 'Completed task cards should preserve readable spacing and text boundaries.' })
  ];
  await page.addInitScript(({ key, seededTasks }) => {
    if (sessionStorage.getItem('__focusboardResponsiveSeeded') === '1') return;
    localStorage.removeItem(key);
    localStorage.setItem(key, JSON.stringify(seededTasks));
    sessionStorage.setItem('__focusboardResponsiveSeeded', '1');
  }, { key: STORAGE_KEY, seededTasks: tasks });
  await page.goto('/');
}

async function assertViewportLayout(page, viewport, expectedColumns) {
  const measurements = await page.evaluate(() => {
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const visible = element => element.getClientRects().length > 0;
    const board = document.querySelector('#task-board');
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      boardDisplay: getComputedStyle(board).display,
      boardColumns: getComputedStyle(board).display === 'grid'
        ? getComputedStyle(board).gridTemplateColumns.split(' ').length
        : 1,
      board: rect(board),
      columns: [...board.querySelectorAll(':scope > section')].map(rect),
      controls: [...document.querySelectorAll('input, textarea, select, button, form, .task-portability-controls, [role="status"]')]
        .filter(visible).map(rect),
      cards: [...document.querySelectorAll('.task-card')].map(rect),
      statusControls: [...board.querySelectorAll('.task-card .task-status-select')].map(element => ({ control: rect(element), card: rect(element.closest('.task-card')) })),
      cardText: [...board.querySelectorAll(':scope > section')].flatMap(column => [...column.querySelectorAll('.task-card h4, .task-card > p, .task-card .task-details')].map(element => ({ column: rect(column), text: rect(element) })))
    };
  });

  expect(measurements.scrollWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(measurements.boardColumns).toBe(expectedColumns);
  for (const [index, column] of measurements.columns.entries()) {
    expect(column.left, `column ${index} left at ${viewport.width}px`).toBeGreaterThanOrEqual(-1);
    expect(column.right, `column ${index} right at ${viewport.width}px`).toBeLessThanOrEqual(measurements.viewportWidth + 1);
  }
  for (const [index, element] of measurements.controls.entries()) {
    expect(element.left, `control ${index} left at ${viewport.width}px`).toBeGreaterThanOrEqual(-1);
    expect(element.right, `control ${index} right at ${viewport.width}px`).toBeLessThanOrEqual(measurements.viewportWidth + 1);
  }
  for (const [index, card] of measurements.cards.entries()) {
    const column = measurements.columns[index];
    expect(card.left, `card ${index} left at ${viewport.width}px`).toBeGreaterThanOrEqual(column.left);
    expect(card.right, `card ${index} right at ${viewport.width}px`).toBeLessThanOrEqual(column.right);
  }
  for (const [index, entry] of measurements.statusControls.entries()) {
    expect(entry.control.left, `status select ${index} left within card at ${viewport.width}px`).toBeGreaterThanOrEqual(entry.card.left);
    expect(entry.control.right, `status select ${index} right within card at ${viewport.width}px`).toBeLessThanOrEqual(entry.card.right);
  }
  for (const [index, entry] of measurements.cardText.entries()) {
    expect(entry.text.left, `card text ${index} left at ${viewport.width}px`).toBeGreaterThanOrEqual(entry.column.left);
    expect(entry.text.right, `card text ${index} right at ${viewport.width}px`).toBeLessThanOrEqual(entry.column.right);
  }

  await expect(page.locator('#task-title')).toBeVisible();
  await expect(page.locator('#task-submit')).toBeEnabled();
  await expect(page.locator('#export-tasks')).toBeVisible();
  await expect(page.locator('#task-search')).toBeVisible();
  await expect(page.locator('#clear-task-filters')).toBeEnabled();

  await page.locator('#task-search').fill('no responsive task should match');
  const resultMessage = page.locator('#task-results-message');
  await expect(resultMessage).toBeVisible();
  const messageBounds = await resultMessage.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right };
  });
  expect(messageBounds.left).toBeGreaterThanOrEqual(-1);
  expect(messageBounds.right).toBeLessThanOrEqual(measurements.viewportWidth + 1);
}

test('desktop1440x900HasNoOverflowAndThreeBoardColumns', async ({ page }) => {
  const viewport = { width: 1440, height: 900 };
  await openSeededBoard(page, viewport);
  await assertViewportLayout(page, viewport, 3);
});

test('tablet768x1024HasNoOverflowAndExpectedBoardColumns', async ({ page }) => {
  const viewport = { width: 768, height: 1024 };
  await openSeededBoard(page, viewport);
  await assertViewportLayout(page, viewport, 3);
});

test('mobile375x812HasNoOverflowAndStackedBoardColumns', async ({ page }) => {
  const viewport = { width: 375, height: 812 };
  await openSeededBoard(page, viewport);
  await assertViewportLayout(page, viewport, 1);
  const columns = await page.locator('#task-board > section').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }));
  expect(columns[0].left).toBeCloseTo(columns[1].left, 0);
  expect(columns[1].left).toBeCloseTo(columns[2].left, 0);
  expect(columns[1].top).toBeGreaterThan(columns[0].top);
  expect(columns[2].top).toBeGreaterThan(columns[1].top);
});
