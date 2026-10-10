import { expect, test } from '@playwright/test';
import {
  loadTasks,
  parseTaskExport,
  saveTasks,
  serializeTaskExport,
  STORAGE_KEY,
  validateTasks
} from '../scripts/storage.js';
import { makeTask } from './support/task-fixtures.js';

const taskFields = ['id', 'title', 'description', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'];
let originalWindow;

function installStorage(storage) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage }
  });
}

test.beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
});

test.afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
  } else {
    delete globalThis.window;
  }
});

test('loadTasksReturnsMissingForAbsentKey', () => {
  installStorage({ getItem: () => null });
  expect(loadTasks()).toEqual({ status: 'missing', tasks: [] });
});

test('loadTasksReturnsLoadedForValidStoredTasks', () => {
  const tasks = [makeTask({ id: 'stored-a' }), makeTask({ id: 'stored-b', title: 'Second' })];
  installStorage({ getItem: key => key === STORAGE_KEY ? JSON.stringify(tasks) : null });
  expect(loadTasks()).toEqual({ status: 'loaded', tasks });
});

test('loadTasksDistinguishesCorruptJsonFromInvalidTaskShape', () => {
  let savedBytes = '{broken';
  installStorage({ getItem: () => savedBytes });
  expect(loadTasks().status).toBe('corrupt');
  expect(savedBytes).toBe('{broken');

  const invalid = [makeTask({ id: 'duplicate' }), makeTask({ id: 'duplicate' })];
  savedBytes = JSON.stringify(invalid);
  expect(loadTasks().status).toBe('invalid');
  expect(savedBytes).toBe(JSON.stringify(invalid));
});

test('loadTasksReturnsUnavailableWhenStorageReadThrows', () => {
  installStorage({ getItem: () => { throw new Error('blocked'); } });
  expect(loadTasks()).toEqual({ status: 'unavailable', tasks: [] });
});

test('saveTasksReturnsFailureWhenStorageWriteThrows', () => {
  installStorage({ setItem: () => { throw new Error('quota'); } });
  expect(saveTasks([makeTask()])).toEqual({ ok: false });
});

test('saveTasksPersistsCanonicalTaskArray', () => {
  const tasks = [makeTask({ id: 'first' }), makeTask({ id: 'second' })];
  const values = new Map();
  installStorage({
    setItem: (key, value) => values.set(key, value),
    getItem: key => values.get(key) ?? null
  });

  expect(saveTasks(tasks)).toEqual({ ok: true });
  expect([...values.keys()]).toEqual([STORAGE_KEY]);
  expect(JSON.parse(values.get(STORAGE_KEY))).toEqual(tasks);
  expect(Array.isArray(JSON.parse(values.get(STORAGE_KEY)))).toBe(true);
});

test('serializeTaskExportUsesVersionOneAndCanonicalFields', () => {
  const tasks = [makeTask({ id: 'first', extra: 'ignored' }), makeTask({ id: 'second', title: 'Second' })];
  const envelope = JSON.parse(serializeTaskExport(tasks));

  expect(envelope.format).toBe('focusboard-tasks');
  expect(envelope.version).toBe(1);
  expect(Object.keys(envelope)).toEqual(['format', 'version', 'tasks']);
  expect(envelope.tasks.map(task => Object.keys(task))).toEqual([taskFields, taskFields]);
  expect(envelope.tasks.map(task => task.id)).toEqual(['first', 'second']);
  expect(envelope.tasks[0]).not.toHaveProperty('extra');
});

test('parseTaskExportAcceptsValidEnvelopeAndReturnsCopies', () => {
  const task = makeTask({ id: 'imported' });
  const parsed = parseTaskExport(JSON.stringify({ format: 'focusboard-tasks', version: 1, tasks: [task] }));

  expect(parsed).toEqual({ ok: true, tasks: [task] });
  expect(parsed.tasks[0]).not.toBe(task);
});

test('parseTaskExportRejectsInvalidJsonAndUnsupportedEnvelope', () => {
  expect(parseTaskExport('{broken')).toEqual({ ok: false, error: 'invalid-json' });
  const validTask = makeTask();
  const valid = { format: 'focusboard-tasks', version: 1, tasks: [validTask] };
  const invalidEnvelopes = [
    { ...valid, version: 2 },
    { ...valid, format: 'other' },
    { ...valid, extra: true },
    { format: valid.format, tasks: valid.tasks },
    { ...valid, tasks: {} }
  ];
  for (const envelope of invalidEnvelopes) {
    expect(parseTaskExport(JSON.stringify(envelope)).ok).toBe(false);
  }
});

test('parseTaskExportRejectsInvalidTasksDuplicateIdsAndExtraFields', () => {
  const valid = makeTask({ id: 'valid' });
  const invalidTasks = [
    makeTask({ status: 'blocked' }),
    makeTask({ dueDate: '2026-02-30' }),
    makeTask({ title: '   ' }),
    { ...valid, description: undefined }
  ];
  for (const task of invalidTasks) {
    expect(validateTasks([task])).toBe(false);
    expect(parseTaskExport(JSON.stringify({ format: 'focusboard-tasks', version: 1, tasks: [task] })).ok).toBe(false);
  }
  const taskWithExtraField = { ...valid, extra: 'unexpected' };
  expect(validateTasks([taskWithExtraField])).toBe(true);
  expect(parseTaskExport(JSON.stringify({ format: 'focusboard-tasks', version: 1, tasks: [taskWithExtraField] })).ok).toBe(false);  expect(validateTasks([valid, { ...valid }])).toBe(false);
  expect(parseTaskExport(JSON.stringify({ format: 'focusboard-tasks', version: 1, tasks: [valid, { ...valid }] })).ok).toBe(false);
});


