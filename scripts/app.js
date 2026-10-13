import {
  createTask,
  deleteTask,
  getDueDateStatus,
  getTasks,
  getProgressSummary,
  getPendingDeleteUndo,
  getTaskById,
  getTasksByStatus,
  getVisibleTasks,
  sortTasks,
  setTasks,
  undoLastDelete,
  updateTask,
} from "./tasks.js";
import {
  loadTasks,
  parseTaskExport,
  saveTasks,
  serializeTaskExport,
} from "./storage.js";

const storageLoadResult = loadTasks();
if (storageLoadResult.status === "loaded") {
  setTasks(storageLoadResult.tasks);
}
// Preserve corrupt or invalid saved data until a valid restore succeeds.
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
const dueDateFilter = searchAndFiltersForm.elements.dueDate;
const sortSelect = searchAndFiltersForm.elements.sort;
const clearFiltersButton = document.querySelector("#clear-task-filters");
const activeFilterSummary = document.querySelector("#active-filter-summary");
const taskResultsMessage = document.querySelector("#task-results-message");
const storageMessage = document.querySelector("#storage-message");
const exportTasksButton = document.querySelector("#export-tasks");
const restoreFileInput = document.querySelector("#restore-file");
const portabilityMessage = document.querySelector("#portability-message");
const undoDeleteNotice = document.querySelector("#undo-delete-notice");
const undoDeleteMessage = document.querySelector("#undo-delete-message");
const undoDeleteButton = document.querySelector("#undo-delete-button");
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
  dueDate.textContent = `Due date: ${formatDueDate(task.dueDate)}`;
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
    dueDate: dueDateFilter.value,
  };
}

function hasActiveFilters(filters) {
  return Boolean(filters.search.trim())
    || filters.status !== "all"
    || filters.priority !== "all"
    || filters.dueDate !== "all";
}

function renderActiveFilterSummary(filters, sortBy, visibleCount, totalCount) {
  const activeFilters = [];
  const searchText = filters.search.trim();

  if (searchText) activeFilters.push(`Search: "${searchText}"`);
  if (filters.status !== "all") {
    activeFilters.push(`Status: ${filters.status.charAt(0).toUpperCase()}${filters.status.slice(1)}`);
  }
  if (filters.priority !== "all") {
    activeFilters.push(`Priority: ${filters.priority.charAt(0).toUpperCase()}${filters.priority.slice(1)}`);
  }

  const dueDateLabels = {
    overdue: "Overdue",
    today: "Due today",
    upcoming: "Upcoming",
    "no-due-date": "No due date",
  };
  if (filters.dueDate !== "all") {
    activeFilters.push(`Due date: ${dueDateLabels[filters.dueDate] || "All"}`);
  }

  const hasSort = sortBy !== "default";
  if (activeFilters.length === 0 && !hasSort) {
    activeFilterSummary.textContent = "";
    activeFilterSummary.hidden = true;
    return;
  }

  const resultCount = activeFilters.length > 0
    ? `Showing ${visibleCount} of ${totalCount} tasks.`
    : `Showing all ${totalCount} tasks.`;
  const filterText = activeFilters.length > 0
    ? ` Active filters: ${activeFilters.join("; ")}.`
    : "";
  const sortText = hasSort
    ? ` Sorted by ${sortSelect.options[sortSelect.selectedIndex].textContent}.`
    : "";

  activeFilterSummary.textContent = `${resultCount}${filterText}${sortText}`;
  activeFilterSummary.hidden = false;
}

function renderTasks(visibleTasks, allTasks, filters) {
  const filteredView = hasActiveFilters(filters);
  const noTasksExist = allTasks.length === 0;
  const noMatches = !noTasksExist && filteredView && visibleTasks.length === 0;

  taskResultsMessage.hidden = !noMatches && !noTasksExist;
  taskResultsMessage.textContent = noTasksExist
    ? "No tasks yet. Add a task above to get started."
    : noMatches
      ? "No tasks match your current filters. Try changing or clearing your filters."
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
  renderActiveFilterSummary(filters, sortSelect.value, visibleTasks.length, taskList.length);
  // Counts describe the complete collection, not the current view.
  renderProgressSummary(taskList);
}

function getTaskActionButton(taskId, action) {
  return Array.from(tasksPanel.querySelectorAll(`button[data-action="${action}"][data-task-id]`))
    .find((button) => button.dataset.taskId === taskId) || null;
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
  if (event.target === statusFilter || event.target === priorityFilter
    || event.target === dueDateFilter || event.target === sortSelect) {
    renderDashboard(getTasks());
  }
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "all";
  priorityFilter.value = "all";
  dueDateFilter.value = "all";
  sortSelect.value = "default";
  renderDashboard(getTasks());
});

function showFormMessage(message) {
  taskFormMessage.textContent = message;
}

function showStorageMessage(message) {
  storageMessage.textContent = message;
  storageMessage.hidden = !message;
}

function showPortabilityMessage(message) {
  portabilityMessage.textContent = message;
  portabilityMessage.hidden = !message;
}

function showUndoDeleteMessage(message, task = null) {
  undoDeleteNotice.hidden = false;
  undoDeleteMessage.textContent = message;
  undoDeleteButton.hidden = !task;

  if (task) {
    undoDeleteButton.setAttribute("aria-label", `Undo delete of ${task.title}`);
  } else {
    undoDeleteButton.removeAttribute("aria-label");
  }
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

exportTasksButton.addEventListener("click", () => {
  let objectUrl = null;
  let downloadLink = null;

  try {
    const exportText = serializeTaskExport(getTasks());
    const exportFile = new Blob([exportText], { type: "application/json" });
    objectUrl = URL.createObjectURL(exportFile);

    downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    downloadLink.download = `focusboard-tasks-${getLocalDateString()}.json`;
    downloadLink.hidden = true;
    document.body.append(downloadLink);
    downloadLink.click();
    showPortabilityMessage("Tasks exported successfully.");
  } catch {
    showPortabilityMessage("Export failed. Your tasks were not changed.");
  } finally {
    downloadLink?.remove();
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  }
});

undoDeleteButton.addEventListener("click", (event) => {
  const shouldRestoreKeyboardFocus = event.detail === 0
    && undoDeleteButton.matches(":focus-visible");
  const restoredTask = undoLastDelete();
  if (!restoredTask) {
    showUndoDeleteMessage("Undo is no longer available.");
    if (shouldRestoreKeyboardFocus) {
      undoDeleteMessage.focus();
    }
    return;
  }

  const wasSaved = saveCurrentTasks();
  renderDashboard(getTasks());
  const message = wasSaved
    ? "Task restored."
    : `Task "${restoredTask.title}" restored for this session, but could not be saved and may not remain after reload.`;
  showUndoDeleteMessage(message);

  if (shouldRestoreKeyboardFocus) {
    const editButton = getTaskActionButton(restoredTask.id, "edit");
    (editButton || undoDeleteMessage).focus();
  }
});

restoreFileInput.addEventListener("change", async () => {
  const file = restoreFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    let fileText;
    try {
      fileText = await file.text();
    } catch {
      showPortabilityMessage("Could not read the selected file. Your current tasks were not changed.");
      return;
    }

    const result = parseTaskExport(fileText);
    if (!result.ok) {
      const message = result.error === "invalid-json"
        ? "The selected file is not valid JSON. Your current tasks were not changed."
        : "This file is not a supported FocusBoard export. Your current tasks were not changed.";
      showPortabilityMessage(message);
      return;
    }

    if (!window.confirm("Restore tasks from this file? This will replace all current tasks.")) {
      return;
    }

    const saveResult = saveTasks(result.tasks);
    if (!saveResult.ok) {
      showPortabilityMessage("Restore could not be saved. Your current tasks were not changed.");
      return;
    }

    setTasks(result.tasks);
    storageWritesAllowed = true;
    storageWriteFailed = false;
    showStorageMessage("");

    searchInput.value = "";
    statusFilter.value = "all";
    priorityFilter.value = "all";
    dueDateFilter.value = "all";
    sortSelect.value = "default";
    resetTaskForm();
    renderDashboard(getTasks());
    showPortabilityMessage("Tasks restored successfully.");
  } finally {
    restoreFileInput.value = "";
  }
});

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

function startEditingTask(taskId, shouldFocusTitle = true) {
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
  if (shouldFocusTitle) {
    taskForm.elements.title.focus();
  }
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

taskCancelButton.addEventListener("click", (event) => {
  const shouldRestoreKeyboardFocus = event.detail === 0
    && taskCancelButton.matches(":focus-visible");
  const cancelledTaskId = editingTaskId;
  resetTaskForm();

  if (!shouldRestoreKeyboardFocus) {
    return;
  }

  const editButton = getTaskActionButton(cancelledTaskId, "edit");
  (editButton || taskForm.elements.title).focus();
});

tasksPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action][data-task-id]");
  if (!button || !tasksPanel.contains(button)) {
    return;
  }

  const { action, taskId } = button.dataset;
  if (action === "edit") {
    const shouldFocusTitle = event.detail === 0 && button.matches(":focus-visible");
    startEditingTask(taskId, shouldFocusTitle);
    return;
  }

  if (action === "delete") {
    const task = getTaskById(taskId);
    if (!task) {
      renderDashboard(getTasks());
      showFormMessage("That task is no longer available. The task list was refreshed.");
      return;
    }

    const shouldRestoreKeyboardFocus = event.detail === 0
      && button.matches(":focus-visible");
    const taskColumn = statusSections[task.status];
    const visibleTaskIds = shouldRestoreKeyboardFocus
      ? Array.from(taskColumn.querySelectorAll('button[data-action="edit"][data-task-id]'))
        .map((editButton) => editButton.dataset.taskId)
      : [];
    const deletedTaskIndex = visibleTaskIds.indexOf(taskId);

    if (window.confirm(`Delete "${task.title}"? You can undo this action.`)) {
      const wasDeleted = deleteTask(taskId);
      let wasSaved = false;
      if (wasDeleted) {
        wasSaved = saveCurrentTasks();
      }
      if (editingTaskId === taskId) {
        resetTaskForm();
      }
      renderDashboard(getTasks());

      const pendingUndo = wasDeleted ? getPendingDeleteUndo() : null;
      if (pendingUndo) {
        const message = wasSaved
          ? `Deleted "${pendingUndo.task.title}". Undo is available.`
          : `Deleted "${pendingUndo.task.title}" for this session. The change was not saved; Undo is available.`;
        showUndoDeleteMessage(message, pendingUndo.task);
      }

      if (shouldRestoreKeyboardFocus) {
        const nextTaskId = visibleTaskIds[deletedTaskIndex + 1]
          || visibleTaskIds[deletedTaskIndex - 1];
        const focusTarget = nextTaskId
          ? getTaskActionButton(nextTaskId, "edit")
          : taskColumn.querySelector("h3");
        focusTarget?.focus();
      }
    } else if (shouldRestoreKeyboardFocus && !button.matches(":focus")) {
      button.focus();
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
