export const STORAGE_KEY = "focusboard.tasks.v1";

const allowedStatuses = new Set(["todo", "doing", "done"]);
const allowedPriorities = new Set(["low", "medium", "high"]);
const exportFormat = "focusboard-tasks";
const exportVersion = 1;
const taskFields = [
  "id",
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "createdAt",
  "updatedAt",
];

function hasExactFields(value, fields) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

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

export function serializeTaskExport(taskList) {
  if (!validateTasks(taskList)) {
    throw new TypeError("Cannot export invalid task data.");
  }

  const canonicalTasks = taskList.map((task) => Object.fromEntries(
    taskFields.map((field) => [field, task[field]]),
  ));

  return JSON.stringify({
    format: exportFormat,
    version: exportVersion,
    tasks: canonicalTasks,
  }, null, 2);
}

export function parseTaskExport(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "invalid-json" };
  }

  if (!hasExactFields(data, ["format", "version", "tasks"])
    || data.format !== exportFormat
    || data.version !== exportVersion
    || !Array.isArray(data.tasks)
    || !data.tasks.every((task) => hasExactFields(task, taskFields))
    || !validateTasks(data.tasks)) {
    return { ok: false, error: "invalid-format" };
  }

  return {
    ok: true,
    tasks: data.tasks.map((task) => ({ ...task })),
  };
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
