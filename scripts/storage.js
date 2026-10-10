export const STORAGE_KEY = "focusboard.tasks.v1";

const allowedStatuses = new Set(["todo", "doing", "done"]);
const allowedPriorities = new Set(["low", "medium", "high"]);

function isValidDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidTask(task) {
  return task !== null
    && typeof task === "object"
    && typeof task.id === "string"
    && task.id.trim().length > 0
    && typeof task.title === "string"
    && task.title.trim().length > 0
    && typeof task.description === "string"
    && allowedStatuses.has(task.status)
    && allowedPriorities.has(task.priority)
    && (task.dueDate === null || isValidDateOnly(task.dueDate))
    && isValidTimestamp(task.createdAt)
    && isValidTimestamp(task.updatedAt);
}

export function validateTasks(value) {
  if (!Array.isArray(value) || !value.every(isValidTask)) {
    return false;
  }

  const ids = new Set(value.map((task) => task.id));
  return ids.size === value.length;
}

export function loadTasks() {
  let savedData;

  try {
    savedData = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: "unavailable", tasks: [] };
  }

  if (savedData === null) {
    return { status: "missing", tasks: [] };
  }

  let parsedTasks;
  try {
    parsedTasks = JSON.parse(savedData);
  } catch {
    return { status: "corrupt", tasks: [] };
  }

  if (!validateTasks(parsedTasks)) {
    return { status: "invalid", tasks: [] };
  }

  return { status: "loaded", tasks: parsedTasks };
}

export function saveTasks(taskList) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskList));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
