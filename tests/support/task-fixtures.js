export function makeTask(overrides = {}) {
  return {
    id: 'task-default',
    title: 'Default task',
    description: 'Fixture description',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}
