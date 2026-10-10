// This module owns the in-memory task list. Dates use YYYY-MM-DD calendar dates.
let tasks = [];

export function setTasks(taskList) {
  tasks = taskList.map((task) => ({ ...task }));
}

export function getTasks() {
  return tasks.map((task) => ({ ...task }));
}

function findTaskById(taskId) {
  return tasks.find((task) => task.id === taskId) || null;
}

function createTaskId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `task-${randomId || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function getTaskById(taskId) {
  const task = findTaskById(taskId);
  return task ? { ...task } : null;
}

export function createTask(fields) {
  const now = new Date().toISOString();
  const task = {
    id: createTaskId(),
    title: fields.title.trim(),
    description: fields.description?.trim() || "",
    status: fields.status || "todo",
    priority: fields.priority || "medium",
    dueDate: fields.dueDate || null,
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);
  return { ...task };
}

export function updateTask(taskId, fields) {
  const task = findTaskById(taskId);
  if (!task) {
    return null;
  }

  task.title = fields.title.trim();
  task.description = fields.description?.trim() || "";
  task.status = fields.status || "todo";
  task.priority = fields.priority || "medium";
  task.dueDate = fields.dueDate || null;
  task.updatedAt = new Date().toISOString();

  return { ...task };
}

export function deleteTask(taskId) {
  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) {
    return false;
  }

  tasks.splice(taskIndex, 1);
  return true;
}

export function getTasksByStatus(taskList, status) {
  return taskList.filter((task) => task.status === status);
}

export function matchesSearch(task, searchText) {
  const query = String(searchText || "").trim().toLowerCase();
  if (!query) {
    return true;
  }

  return task.title.toLowerCase().includes(query)
    || (task.description || "").toLowerCase().includes(query);
}

export function matchesStatus(task, selectedStatus) {
  return selectedStatus === "all" || task.status === selectedStatus;
}

export function matchesPriority(task, selectedPriority) {
  return selectedPriority === "all" || task.priority === selectedPriority;
}

export function getVisibleTasks(taskList, filters, today = new Date()) {
  const searchResults = taskList.filter((task) => matchesSearch(task, filters.search));
  const statusResults = searchResults.filter((task) => matchesStatus(task, filters.status));
  const priorityResults = statusResults.filter((task) => matchesPriority(task, filters.priority));
  const dueDateFilter = filters.dueDate || "all";

  if (!["overdue", "today", "upcoming", "no-due-date"].includes(dueDateFilter)) {
    return priorityResults;
  }

  return priorityResults.filter((task) => {
    if (task.status === "done") {
      return false;
    }

    if (dueDateFilter === "no-due-date") {
      return !task.dueDate;
    }

    return getDueDateStatus(task, today) === dueDateFilter;
  });
}

export function sortTasks(taskList, sortBy) {
  const indexedTasks = taskList.map((task, index) => ({ task, index }));
  const priorityRank = { low: 1, medium: 2, high: 3 };

  indexedTasks.sort((first, second) => {
    if (sortBy === "due-date") {
      const firstDueDate = first.task.dueDate;
      const secondDueDate = second.task.dueDate;

      if (!firstDueDate && secondDueDate) return 1;
      if (firstDueDate && !secondDueDate) return -1;
      if (firstDueDate && secondDueDate && firstDueDate !== secondDueDate) {
        return firstDueDate.localeCompare(secondDueDate);
      }
    }

    if (sortBy === "priority") {
      const priorityDifference = priorityRank[second.task.priority] - priorityRank[first.task.priority];
      if (priorityDifference !== 0) return priorityDifference;
    }

    return first.index - second.index;
  });

  return indexedTasks.map(({ task }) => task);
}

export function getDueDateStatus(task, today = new Date()) {
  if (!task.dueDate || task.status === "done") {
    return null;
  }

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  if (dueDate < todayStart) {
    return "overdue";
  }

  if (dueDate.getTime() === todayStart.getTime()) {
    return "today";
  }

  const upcomingEnd = new Date(todayStart);
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  return dueDate <= upcomingEnd ? "upcoming" : null;
}

export function getProgressSummary(taskList) {
  return {
    total: taskList.length,
    inProgress: taskList.filter((task) => task.status === "doing").length,
    completed: taskList.filter((task) => task.status === "done").length,
  };
}
