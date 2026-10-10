import {
  createTask,
  deleteTask,
  getDueDateStatus,
  getTasks,
  getProgressSummary,
  getTaskById,
  getTasksByStatus,
  getVisibleTasks,
  sortTasks,
  setTasks,
  updateTask,
} from "./tasks.js";
import { loadTasks, saveTasks } from "./storage.js";

const storageLoadResult = loadTasks();
if (storageLoadResult.status === "loaded") {
  setTasks(storageLoadResult.tasks);
}
// Keep unreadable saved data untouched until a deliberate recovery action exists.
let storageWritesAllowed = !["corrupt", "invalid"].includes(storageLoadResult.status);
let storageWriteFailed = false;

const statusSections = {
  todo: document.querySelector('[aria-labelledby="todo-heading"]'),
  doing: document.querySelector('[aria-labelledby="doing-heading"]'),
  done: document.querySelector('[aria-labelledby="done-heading"]'),
};
const taskForm = document.querySelector("#task-form");
const taskFormHeading = document.querySelector("#task-form-heading");
const taskFormMessage = document.querySelector("#task-form-message");
const taskSubmitButton = document.querySelector("#task-submit");
const taskCancelButton = document.querySelector("#task-cancel");
const tasksPanel = document.querySelector('[aria-labelledby="tasks-heading"]');
const searchAndFiltersForm = document.querySelector('[aria-label="Search and filter tasks"]');
const searchInput = searchAndFiltersForm.elements.search;
const statusFilter = searchAndFiltersForm.elements.status;
const priorityFilter = searchAndFiltersForm.elements.priority;
const sortSelect = searchAndFiltersForm.elements.sort;
const clearFiltersButton = document.querySelector("#clear-task-filters");
const taskResultsMessage = document.querySelector("#task-results-message");
const storageMessage = document.querySelector("#storage-message");
let editingTaskId = null;
let isSubmitting = false;

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "No due date";
  }

  // Setting noon avoids shifting the displayed calendar date across time zones.
  const date = new Date(`${dueDate}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";

  const cardHeader = document.createElement("div");
  cardHeader.className = "task-card-header";

  const title = document.createElement("h4");
  title.textContent = task.title;

  const badges = document.createElement("div");
  badges.className = "task-badges";
  badges.setAttribute("role", "group");
  badges.setAttribute("aria-label", "Task status and priority");

  const statusBadge = document.createElement("span");
  statusBadge.className = `task-badge status-badge status-${task.status}`;
  statusBadge.textContent = task.status.charAt(0).toUpperCase() + task.status.slice(1);

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `task-badge priority-badge priority-${task.priority}`;
  const formattedPriority = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  priorityBadge.textContent = `Priority: ${formattedPriority}`;

  badges.append(statusBadge, priorityBadge);
  cardHeader.append(title, badges);
  card.append(cardHeader);

  if (task.description) {
    const description = document.createElement("p");
    description.textContent = task.description;
    card.append(description);
  }

  const details = document.createElement("div");
  details.className = "task-details";

  const dueDate = document.createElement("span");
  dueDate.className = "task-due-date";
  dueDate.textContent = `Due: ${formatDueDate(task.dueDate)}`;
  details.append(dueDate);

  const dueDateStatus = getDueDateStatus(task);
  if (dueDateStatus) {
    const indicatorLabels = {
      overdue: "Overdue",
      today: "Due today",
      upcoming: "Upcoming",
    };
    const dueDateIndicator = document.createElement("span");
    dueDateIndicator.className = `due-date-indicator due-${dueDateStatus}`;
    dueDateIndicator.textContent = indicatorLabels[dueDateStatus];
    details.append(dueDateIndicator);
  }

  card.append(details);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.dataset.taskId = task.id;
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${task.title}`);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.taskId = task.id;
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${task.title}`);

  actions.append(editButton, deleteButton);
  card.append(actions);

  return card;
}

function renderTaskSection(section, visibleTasks, status, emptyMessage) {
  if (!section) {
    return;
  }

  const heading = section.querySelector("h3");
  if (!heading) {
    return;
  }

  const matchingTasks = getTasksByStatus(visibleTasks, status);
  section.replaceChildren(heading);

  if (matchingTasks.length === 0) {
    if (emptyMessage) {
      const message = document.createElement("p");
      message.className = "column-empty-state";
      message.textContent = emptyMessage;
      section.append(message);
    }
    return;
  }

  matchingTasks.forEach((task) => {
    section.append(createTaskCard(task));
  });
}

function getCurrentFilters() {
  return {
    search: searchInput.value,
    status: statusFilter.value,
    priority: priorityFilter.value,
  };
}

function hasActiveFilters(filters) {
  return Boolean(filters.search.trim())
    || filters.status !== "all"
    || filters.priority !== "all";
}

function renderTasks(visibleTasks, allTasks, filters) {
  const filteredView = hasActiveFilters(filters);
  const noTasksExist = allTasks.length === 0;
  const noMatches = !noTasksExist && filteredView && visibleTasks.length === 0;

  taskResultsMessage.hidden = !noMatches && !noTasksExist;
  taskResultsMessage.textContent = noTasksExist
    ? "No tasks yet. Add a task above to get started."
    : noMatches
      ? "No tasks match your search or filters. Adjust or clear them to see tasks."
      : "";

  const getColumnEmptyMessage = (status) => {
    if (noTasksExist || noMatches) return "";
    if (filteredView) return "No matching tasks in this section.";
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    return `No ${statusLabel} tasks yet.`;
  };

  renderTaskSection(statusSections.todo, visibleTasks, "todo", getColumnEmptyMessage("todo"));
  renderTaskSection(statusSections.doing, visibleTasks, "doing", getColumnEmptyMessage("doing"));
  renderTaskSection(statusSections.done, visibleTasks, "done", getColumnEmptyMessage("done"));
}

function renderProgressSummary(taskList) {
  const summary = getProgressSummary(taskList);

  document.querySelector("#total-task-count").textContent = summary.total;
  document.querySelector("#in-progress-count").textContent = summary.inProgress;
  document.querySelector("#completed-task-count").textContent = summary.completed;
}

function renderDashboard(taskList) {
  const filters = getCurrentFilters();
  const filteredTasks = getVisibleTasks(taskList, filters);
  const visibleTasks = sortTasks(filteredTasks, sortSelect.value);
  renderTasks(visibleTasks, taskList, filters);
  // Counts describe the complete collection, not the current view.
  renderProgressSummary(taskList);
}

searchAndFiltersForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

searchAndFiltersForm.addEventListener("input", (event) => {
  if (event.target === searchInput) {
    renderDashboard(getTasks());
  }
});

searchAndFiltersForm.addEventListener("change", (event) => {
  if (event.target === statusFilter || event.target === priorityFilter || event.target === sortSelect) {
    renderDashboard(getTasks());
  }
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "all";
  priorityFilter.value = "all";
  renderDashboard(getTasks());
  searchInput.focus();
});

function showFormMessage(message) {
  taskFormMessage.textContent = message;
}

function showStorageMessage(message) {
  storageMessage.textContent = message;
  storageMessage.hidden = !message;
}

function saveCurrentTasks() {
  if (!storageWritesAllowed) {
    return false;
  }

  const result = saveTasks(getTasks());
  if (!result.ok) {
    storageWriteFailed = true;
    showStorageMessage("Your changes are only in this session because browser storage could not be updated.");
    return false;
  }

  if (storageLoadResult.status === "unavailable" || storageWriteFailed) {
    storageWriteFailed = false;
    showStorageMessage("");
  }
  return true;
}

function resetTaskForm() {
  taskForm.reset();
  editingTaskId = null;
  taskFormHeading.textContent = "Add a task";
  taskSubmitButton.textContent = "Add task";
  taskCancelButton.hidden = true;
  showFormMessage("");
}

function getFormFields() {
  return {
    title: taskForm.elements.title.value.trim(),
    description: taskForm.elements.description.value,
    status: taskForm.elements.status.value || "todo",
    priority: taskForm.elements.priority.value || "medium",
    dueDate: taskForm.elements.dueDate.value || null,
  };
}

function startEditingTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    renderDashboard(getTasks());
    showFormMessage("That task is no longer available. The task list was refreshed.");
    return;
  }

  editingTaskId = task.id;
  taskForm.elements.title.value = task.title;
  taskForm.elements.description.value = task.description;
  taskForm.elements.status.value = task.status;
  taskForm.elements.priority.value = task.priority;
  taskForm.elements.dueDate.value = task.dueDate || "";
  taskFormHeading.textContent = "Edit task";
  taskSubmitButton.textContent = "Save changes";
  taskCancelButton.hidden = false;
  showFormMessage("");
  taskForm.elements.title.focus();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSubmitting) {
    return;
  }

  const fields = getFormFields();
  if (!fields.title) {
    showFormMessage("Please enter a title for the task.");
    taskForm.elements.title.focus();
    return;
  }

  isSubmitting = true;
  taskSubmitButton.disabled = true;

  if (editingTaskId) {
    const updatedTask = updateTask(editingTaskId, fields);
    if (!updatedTask) {
      renderDashboard(getTasks());
      resetTaskForm();
      showFormMessage("That task is no longer available. The task list was refreshed.");
    } else {
      saveCurrentTasks();
      renderDashboard(getTasks());
      resetTaskForm();
    }
  } else {
    createTask(fields);
    saveCurrentTasks();
    renderDashboard(getTasks());
    resetTaskForm();
  }

  taskSubmitButton.disabled = false;
  isSubmitting = false;
});

taskCancelButton.addEventListener("click", resetTaskForm);

tasksPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action][data-task-id]");
  if (!button || !tasksPanel.contains(button)) {
    return;
  }

  const { action, taskId } = button.dataset;
  if (action === "edit") {
    startEditingTask(taskId);
    return;
  }

  if (action === "delete") {
    const task = getTaskById(taskId);
    if (!task) {
      renderDashboard(getTasks());
      showFormMessage("That task is no longer available. The task list was refreshed.");
      return;
    }

    if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      const wasDeleted = deleteTask(taskId);
      if (wasDeleted) {
        saveCurrentTasks();
      }
      if (editingTaskId === taskId) {
        resetTaskForm();
      }
      renderDashboard(getTasks());
    }
  }
});

renderDashboard(getTasks());

if (storageLoadResult.status === "corrupt") {
  showStorageMessage("Saved tasks could not be read. The saved data was left untouched; changes in this session will not be saved.");
} else if (storageLoadResult.status === "invalid") {
  showStorageMessage("Saved tasks have an invalid format. The saved data was left untouched; changes in this session will not be saved.");
} else if (storageLoadResult.status === "unavailable") {
  showStorageMessage("Browser storage is unavailable. FocusBoard will work for this session, but changes may not be saved.");
}
