import { expect, test } from '@playwright/test';
import {
  createTask,
  deleteTask,
  getDueDateStatus,
  getTasks,
  getVisibleTasks,
  setTasks,
  sortTasks,
  updateTask
} from '../scripts/tasks.js';
import { makeTask } from './support/task-fixtures.js';

const localToday = new Date(2026, 9, 10);
const allFilters = overrides => ({ search: '', status: 'all', priority: 'all', dueDate: 'all', ...overrides });

test.beforeEach(() => setTasks([]));

test.describe('task state operations', () => {
  test('createTaskTrimsFieldsAndSetsDefaults', () => {
    const first = createTask({ title: '  First task  ', description: '  Details  ' });
    const second = createTask({ title: 'Second task' });

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    expect(first.title).toBe('First task');
    expect(first.description).toBe('Details');
    expect(first.status).toBe('todo');
    expect(first.priority).toBe('medium');
    expect(first.dueDate).toBeNull();
    expect(Date.parse(first.createdAt)).not.toBeNaN();
    expect(Date.parse(first.updatedAt)).not.toBeNaN();
  });

  test('updateTaskChangesEditableFieldsAndPreservesIdentity', () => {
    const original = makeTask({ id: 'edit-me', createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' });
    setTasks([original]);

    const updated = updateTask('edit-me', {
      title: '  Updated title ', description: ' updated description ', status: 'doing', priority: 'high', dueDate: '2026-10-17'
    });

    expect(updated).toMatchObject({
      id: 'edit-me', title: 'Updated title', description: 'updated description', status: 'doing',
      priority: 'high', dueDate: '2026-10-17', createdAt: original.createdAt
    });
    expect(updated.updatedAt).not.toBe(original.updatedAt);
  });

  test('updateTaskReturnsNullForUnknownId', () => {
    expect(updateTask('missing', { title: 'No task' })).toBeNull();
  });

  test('deleteTaskReturnsFalseForUnknownId', () => {
    expect(deleteTask('missing')).toBe(false);
  });

  test('deleteTaskRemovesOnlyMatchingId', () => {
    const tasks = [makeTask({ id: 'first' }), makeTask({ id: 'middle' }), makeTask({ id: 'last' })];
    setTasks(tasks);

    expect(deleteTask('middle')).toBe(true);
    expect(getTasks()).toEqual([tasks[0], tasks[2]]);
  });
});

test.describe('task filters and sorting', () => {
  test('getVisibleTasksMatchesSearchStatusPriorityAndDueDateTogether', () => {
    const matching = makeTask({ id: 'match', title: 'Review launch notes', status: 'todo', priority: 'high', dueDate: '2026-10-12' });
    const tasks = [
      matching,
      makeTask({ id: 'search-miss', title: 'Write launch notes', status: 'todo', priority: 'high', dueDate: '2026-10-12' }),
      makeTask({ id: 'status-miss', title: 'Review launch notes', status: 'doing', priority: 'high', dueDate: '2026-10-12' }),
      makeTask({ id: 'priority-miss', title: 'Review launch notes', status: 'todo', priority: 'low', dueDate: '2026-10-12' }),
      makeTask({ id: 'date-miss', title: 'Review launch notes', status: 'todo', priority: 'high', dueDate: '2026-10-19' })
    ];

    expect(getVisibleTasks(tasks, {
      search: 'review', status: 'todo', priority: 'high', dueDate: 'upcoming'
    }, localToday)).toEqual([matching]);
  });

  test('dueDateFiltersUseLocalBoundariesAndExcludeDoneTasks', () => {
    expect(getDueDateStatus(makeTask({ dueDate: '2026-10-09' }), localToday)).toBe('overdue');
    expect(getDueDateStatus(makeTask({ dueDate: '2026-10-10' }), localToday)).toBe('today');
    expect(getDueDateStatus(makeTask({ dueDate: '2026-10-11' }), localToday)).toBe('upcoming');
    expect(getDueDateStatus(makeTask({ dueDate: '2026-10-17' }), localToday)).toBe('upcoming');
    expect(getDueDateStatus(makeTask({ dueDate: '2026-10-18' }), localToday)).toBeNull();

    const doneTasks = [
      makeTask({ id: 'done-overdue', status: 'done', dueDate: '2026-10-09' }),
      makeTask({ id: 'done-today', status: 'done', dueDate: '2026-10-10' }),
      makeTask({ id: 'done-upcoming', status: 'done', dueDate: '2026-10-11' }),
      makeTask({ id: 'done-none', status: 'done', dueDate: null })
    ];
    for (const dueDate of ['overdue', 'today', 'upcoming', 'no-due-date']) {
      const openTask = makeTask({ id: 'open-' + dueDate, dueDate: dueDate === 'overdue' ? '2026-10-09' : dueDate === 'today' ? '2026-10-10' : dueDate === 'upcoming' ? '2026-10-11' : null });
      expect(getVisibleTasks([...doneTasks, openTask], allFilters({ dueDate }), localToday)).toEqual([openTask]);
    }
  });

  test('noDueDateMatchesOnlyOpenTasksWithoutADueDate', () => {
    const tasks = [
      makeTask({ id: 'todo-null', status: 'todo', dueDate: null }),
      makeTask({ id: 'doing-empty', status: 'doing', dueDate: '' }),
      makeTask({ id: 'todo-dated', status: 'todo', dueDate: '2026-10-12' }),
      makeTask({ id: 'done-null', status: 'done', dueDate: null })
    ];
    expect(getVisibleTasks(tasks, allFilters({ dueDate: 'no-due-date' }), localToday).map(task => task.id)).toEqual(['todo-null', 'doing-empty']);
  });

  test('sortingIsStableAndDoesNotMutateInputOrder', () => {
    const tasks = [
      makeTask({ id: 'no-date', dueDate: null, priority: 'medium' }),
      makeTask({ id: 'later', dueDate: '2026-10-14', priority: 'high' }),
      makeTask({ id: 'high-one', dueDate: '2026-10-12', priority: 'high' }),
      makeTask({ id: 'high-two', dueDate: '2026-10-12', priority: 'high' }),
      makeTask({ id: 'low', dueDate: '2026-10-12', priority: 'low' })
    ];
    const original = structuredClone(tasks);

    expect(sortTasks(tasks, 'due-date').map(task => task.id)).toEqual(['high-one', 'high-two', 'low', 'later', 'no-date']);
    expect(sortTasks(tasks, 'priority').map(task => task.id)).toEqual(['later', 'high-one', 'high-two', 'no-date', 'low']);
    expect(tasks).toEqual(original);
  });

  test('filteringAndCombinedSortingDoNotMutateTaskState', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'Review Alpha', status: 'todo', priority: 'high', dueDate: '2026-10-12' }),
      makeTask({ id: 'b', title: 'Review Beta', status: 'todo', priority: 'high', dueDate: '2026-10-13' }),
      makeTask({ id: 'c', title: 'Review Gamma', status: 'doing', priority: 'high', dueDate: '2026-10-11' })
    ];
    setTasks(tasks);
    const snapshot = getTasks();

    const visible = getVisibleTasks(getTasks(), { search: 'review', status: 'todo', priority: 'high', dueDate: 'upcoming' }, localToday);
    const sorted = sortTasks(visible, 'due-date');

    expect(sorted.map(task => task.id)).toEqual(['a', 'b']);
    expect(getTasks()).toEqual(snapshot);
  });
});
