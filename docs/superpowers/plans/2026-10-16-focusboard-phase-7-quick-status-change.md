# Phase 7 Quick Status Change Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users change a task's Todo, Doing, or Done status directly from its task card while preserving task data, stored order, active views, persistence honesty, and focus behavior.

**Architecture:** Replace the status badge rendered by `createTaskCard()` with a native select that has a task-specific accessible name. A delegated `change` handler will load the complete task with `getTaskById()`, call the existing full-field `updateTask()` API, use `saveCurrentTasks()`, and rerender the current derived view. Add a focused polite status message and keyboard focus recovery; leave task state APIs, storage, schema, and export format unchanged.

**Tech Stack:** Existing HTML5, CSS3, vanilla JavaScript ES modules, localStorage, Node.js ESM tests, Playwright Test with Chromium, and the existing local HTTP test server. No new dependencies.

---

## Execution Progress

- [x] Task 1 — Specify direct status changes with failing browser tests (RED: 6 new tests failed as expected; 1 existing status test passed)
- [x] Task 2 — Add the native status control and persistence-aware state flow (focused suite: 6 new + 1 existing passed; app regression: 24/24 passed)
- [x] Task 3 — Preserve keyboard focus and verify pointer behavior (focused: 4 passed; focus regression: 22/22 passed)
- [x] Task 4 — Cover filter and sort interactions without resetting the view (focused: 10 passed; app + focus regression: 51/51 passed; existing view behavior required no production fix)
- [x] Task 5 — Verify responsive layout and document the feature (responsive: 3/3 passed at 1440x900, 768x1024, 375x812; `git diff --check` passed)
- [x] Task 6 — Run full regression and final scope review (97/97 passed; all three syntax checks and `git diff --check` passed; no out-of-scope tracked files changed)

## Execution Rules

- Execute this plan only after implementation is authorized, in an isolated git worktree based on current `master`; do not implement directly on `master`.
- Follow each task in order. Dependencies: Task 1 tests define the behavior for Task 2; Task 3 adds focus behavior after the control exists; Task 4 covers derived-view edge cases; Task 5 handles responsive styling and documentation; Task 6 is the final regression and review gate.
- For each new behavior, use RED → GREEN → REFACTOR. Do not weaken valid expectations to force a RED result. View tests that pass as characterization after Task 2 should be recorded as such; only add a production fix if an assertion exposes an in-scope defect.
- Keep commits task-sized and separate. Do not push or merge unless the user separately authorizes it.
- This execution is deferring all commits until the user receives the complete verification report, as explicitly requested; do not commit during intermediate tasks.
- Use `npm.cmd test` and the configured HTTP server; browser tests must not use `file://`.
- If a test needs to create unreachable internal state, do not add a test-only production interface.
- Keep all app-facing copy in English. Do not claim full WCAG compliance.

## Scope and Invariants

- The status select replaces the status badge and offers exactly `todo`, `doing`, and `done`; the priority badge remains unchanged.
- The accessible name identifies the task, for example `Status for Prepare demo`.
- `updateTask()` remains a full-field update API. Read the full task first and pass its existing title, description, priority, due date, plus the selected status.
- Updating status must not reorder the canonical task array. Filtering and sorting continue to affect only the rendered view.
- Save through `saveCurrentTasks()`. A failed write leaves the in-memory state changed and must say it was not saved.
- Preserve search, status, priority, due-date, and sort controls and values. Status/due-date filters may hide the updated task according to existing rules.
- Keyboard activation restores focus to the updated select if visible, or to the focusable status message if the task leaves the view. Pointer activation must not receive an app-forced focus move.
- No changes to `scripts/tasks.js`, `scripts/storage.js`, task schema, localStorage key, export format/version, package files, or unrelated layout.

## Files

Expected production changes:

- `scripts/app.js`
- `index.html` only if a dedicated status feedback region is needed
- `styles/main.css`
- `README.md`

Expected test changes:

- `tests/app.spec.js`
- `tests/focus.spec.js`
- `tests/responsive.spec.js` only if a targeted responsive assertion is needed

## Task 1: Specify direct status changes with failing browser tests

**Files:**
- Modify: `tests/app.spec.js`

**Step 1: Add the focused behavior tests**

Add browser tests using the existing `openBoard()`, `taskCard()`, `STORAGE_KEY`, and `makeTask()` helpers:

- `cardStatusSelectHasCurrentValueOptionsAndTaskSpecificName`: seed Todo, Doing, and Done tasks; verify each card has a native select named `Status for <title>`, its value matches the task, and it offers exactly the three status choices.
- `directStatusChangeTodoToDoingPreservesTaskFieldsAndStoredOrder`.
- `directStatusChangeDoingToDonePreservesTaskFieldsAndStoredOrder`.
- `directStatusChangeDoneToTodoPreservesTaskFieldsAndStoredOrder`.
- `directStatusChangePersistsAcrossReload`: change a status, reload, and verify the selected value and destination column.
- `statusChangeSaveFailureKeepsSessionStateAndReportsNotSaved`: block writes to the existing storage key, change a status, and verify the card reflects the new status in this page session, saved localStorage is unchanged, and feedback explicitly says the change was not saved.
- Verify the transition assertions preserve ID, title, description, priority, due date, createdAt, and relative order in localStorage.
- Verify successful status feedback uses a polite status region and accurately says the change was saved.

Use a task list with surrounding tasks in distinct positions/statuses so the assertion proves that only the target status changed and the canonical stored array order did not.

**Step 2: Run the focused tests and confirm RED**

Run: `npm.cmd test -- tests/app.spec.js -g '[sS]tatus'`

Expected: FAIL because task cards currently render a status badge rather than an interactive status select. Confirm failures point to the absent select/behavior.

**Step 3: Commit the tests**

```sh
git add tests/app.spec.js
git commit -m "test: specify direct task status changes"
```

## Task 2: Add the native status control and persistence-aware state flow

**Files:**
- Modify: `scripts/app.js`
- Modify: `index.html` if a focused status message region is required
- Modify: `styles/main.css` for the control/message only
- Test: `tests/app.spec.js`

**Step 1: Implement the status select in task cards**

Replace the status badge in `createTaskCard(task)` with a native `select`. Give it a task-specific accessible name, a stable action marker and task ID, the three existing status values, and the task's current status as its selected value. Keep the priority badge and other card content unchanged. Use text/attributes rather than HTML interpolation for task titles.

**Step 2: Handle status changes through existing task APIs**

Add delegated `change` handling at the task board or task panel. Read the task ID, call `getTaskById()`, and if the task still exists call `updateTask(task.id, { title: task.title, description: task.description, status: selectedStatus, priority: task.priority, dueDate: task.dueDate })`. Do not make `updateTask()` accept partial updates. If the task no longer exists, rerender from `getTasks()` and show a concise stale-task message.

**Step 3: Save, report, and rerender**

Call `saveCurrentTasks()` after the in-memory update. Render with `renderDashboard(getTasks())` so current filters/sort remain in effect. Add or reuse a dedicated polite status region for the action result. On success, state that the task's new status was saved. On failure, state that it changed for this session but was not saved. Keep the existing storage failure message behavior; avoid needlessly repeating its generic wording in the task-specific message.

**Step 4: Run the focused browser tests and confirm GREEN**

Run: `npm.cmd test -- tests/app.spec.js -g '[sS]tatus'`

Expected: PASS for accessible control, all three status directions, field/order preservation, successful persistence/reload, and saved feedback.

**Step 5: Refactor only if the passing tests reveal duplication or unclear flow**

Keep the handler direct and local. Do not add a generic notification or status-update framework. If a small cleanup is justified, preserve behavior and rerun the focused command from Step 4.

**Step 6: Run app regression**

Run: `npm.cmd test -- tests/app.spec.js`

Expected: PASS for existing CRUD, filtering, sorting, Undo, restore, and persistence flows.

**Step 7: Commit Task 2**

```sh
git add scripts/app.js index.html styles/main.css tests/app.spec.js
git commit -m "feat: change task status from task cards"
```

## Task 3: Preserve keyboard focus and verify pointer behavior

**Files:**
- Modify: `tests/focus.spec.js`
- Modify: `scripts/app.js`
- Modify: `index.html` only if the feedback fallback needs `tabindex="-1"`

**Step 1: Add focus tests before focus handling**

Add:

- `keyboardStatusChangeRestoresFocusToUpdatedSelect`: keyboard-change a visible task status and assert focus lands on the same task's newly rendered status select.
- `keyboardStatusChangeUsesMessageFallbackWhenFilteredOut`: activate a Todo task under the Todo status filter, change it to Doing by keyboard, and assert the filter remains Todo, the card is absent, and the task-specific status message is focused.
- `pointerStatusChangeDoesNotForceAppFocus`: change a status with pointer interaction and verify the app did not force focus to the rerendered select or fallback message.
- Assert the status feedback exposes `role="status"` and `aria-live="polite"` where not already covered in `app.spec.js`.

**Step 2: Run focused tests and confirm RED**

Run: `npm.cmd test -- tests/focus.spec.js -g '[sS]tatusChange'`

Expected: keyboard cases fail because the current render replaces the active select; pointer case records current behavior and must not imply app-forced focus.

**Step 3: Implement minimal focus recovery**

Before rerender, detect keyboard modality using the existing `:focus-visible` approach. After rerender, find the status select for the same task using a safe ID comparison, not an interpolated CSS selector. Focus it if present; otherwise focus the programmatically focusable status message. Do not add general-render focus behavior or a forced pointer focus call.

**Step 4: Run focused tests and confirm GREEN**

Run: `npm.cmd test -- tests/focus.spec.js -g '[sS]tatusChange'`

Expected: PASS for keyboard restoration/fallback and no app-forced pointer focus.

**Step 5: Run focus regression**

Run: `npm.cmd test -- tests/focus.spec.js`

Expected: PASS for existing CRUD, Undo, restore, and filter-control focus behavior.

**Step 6: Commit Task 3**

```sh
git add scripts/app.js index.html tests/focus.spec.js
git commit -m "fix: preserve focus on direct status change"
```

## Task 4: Cover filter and sort interactions without resetting the view

**Files:**
- Modify: `tests/app.spec.js`
- Modify production files only if a test identifies an in-scope defect

**Step 1: Add view interaction tests**

Add targeted cases that change status while:

- A status filter matches the old status; verify the card disappears after changing to a different status, the filter value stays unchanged, and the status message receives the keyboard focus fallback.
- Search, priority filter, due-date filter, and a non-default sort are active and the updated task still matches; verify it remains visible, controls retain their values, and displayed order follows the selected sort.
- Search + status + priority + due-date filters + sort are combined; verify the task is visible before the change, becomes hidden only because its new status no longer matches, and underlying storage order is unchanged.

Use a due date relative to the browser's current local date for due-date tests. Ensure the pre-change task matches every active filter; do not try to change a task that is already hidden.

**Step 2: Run focused view tests**

Run: `npm.cmd test -- tests/app.spec.js -g '[sS]tatusChange'`

Expected: PASS if derived rendering already preserves the view; record those as characterization coverage. If any assertion fails, retain it unless setup is demonstrably wrong, then make the smallest fix in the responsible handler/render code.

**Step 3: Run app and focus regressions**

Run: `npm.cmd test -- tests/app.spec.js tests/focus.spec.js`

Expected: PASS with all current and new behavior.

**Step 4: Commit Task 4**

```sh
git add tests/app.spec.js scripts/app.js index.html styles/main.css
git commit -m "test: cover status changes with active views"
```

If no production fix was needed, stage only `tests/app.spec.js`.

## Task 5: Verify responsive layout and document the feature

**Files:**
- Modify: `styles/main.css` only if responsive checks expose a concrete issue
- Modify: `tests/responsive.spec.js` only for a targeted assertion about the new status select
- Modify: `README.md`

**Step 1: Add a targeted responsive assertion if needed**

Use the existing seeded Todo/Doing/Done cards and viewport helper. Verify each card status select remains within the card/viewport bounds at desktop 1440x900, tablet 768x1024, and mobile 375x812. Do not redesign unrelated card or board layout.

**Step 2: Run responsive tests and confirm baseline/result**

Run: `npm.cmd test -- tests/responsive.spec.js`

Expected: PASS at all three viewports. If a concrete overflow/bounds failure is reproduced, first retain it as a failing assertion, then make the smallest CSS adjustment and rerun this suite.

**Step 3: Update README**

Add Quick Status Change to the feature list and manual smoke workflow: change a task across statuses, verify its destination column and persistence after reload, and try the action with an active filter. Correct the stale Current Status sentence that says Undo is unavailable, because Phase 6 is already present. Preserve existing testing, HTTP, responsive, restore, and troubleshooting instructions; do not rewrite the README broadly.

**Step 4: Review documentation whitespace**

Run: `git diff --check`

Expected: no whitespace errors and all app-facing copy remains English.

**Step 5: Commit Task 5**

```sh
git add README.md styles/main.css tests/responsive.spec.js
git commit -m "docs: describe quick task status changes"
```

Stage only files that actually changed.

## Task 6: Run full regression and final scope review

**Files:**
- Verify all changed files; production edits only for a demonstrated in-scope defect, with RED → GREEN first

**Step 1: Run the full regression suite**

Run: `npm.cmd test`

Expected: all existing and new tests pass in Chromium. Report the actual test count and result; do not infer it from the prior 82-test baseline.

**Step 2: Run syntax checks**

Run each command from the repository root:

- `node --check scripts/app.js`
- `node --check scripts/tasks.js`
- `node --check scripts/storage.js`

Expected: all checks pass. `tasks.js` and `storage.js` are checked for regression and are expected to remain unchanged.

**Step 3: Review diff and scope**

Run:

- `git diff --check`
- `git diff --stat`
- `git status --short --branch`
- `git diff -- scripts/tasks.js scripts/storage.js package.json package-lock.json`

Inspect the full diff and verify: task select values/labels, full-field update, in-memory-first save semantics, honest success/failure messages, canonical order unchanged, active view retained, keyboard focus fallback, no forced pointer focus, responsive bounds, and README accuracy. Confirm no schema, key, export, dependency, or out-of-scope changes.

**Step 4: Fix only Critical/Important in-scope findings**

For any demonstrated defect, add or retain a failing test, implement the smallest fix, rerun its focused suite, then rerun `npm.cmd test`. Do not refactor unrelated code.

**Step 5: Record final verification and commit any final fix separately**

Report actual test/syntax/diff results and final git status. If a final behavior fix was necessary, commit it separately after it passes. Do not amend or squash task commits.

## Final Review Checklist

- [x] All three transitions work and preserve every non-status field.
- [x] Card select replaces, rather than duplicates, the status badge; priority badge remains.
- [x] Accessible name identifies the task; status feedback is polite and truthful.
- [x] State updates through `getTaskById()` + full-field `updateTask()`.
- [x] Stored array order remains unchanged; sort affects only the derived view.
- [x] Save success persists across reload; save failure leaves a session-only change with explicit feedback.
- [x] Search, each filter, each sort, and their combination retain control values and expected visibility/order.
- [x] Keyboard focus returns to the updated control or filtered-view status message; pointer gets no app-forced focus.
- [x] Responsive suite passes at 1440x900, 768x1024, and 375x812.
- [x] Full suite and syntax checks pass; changed-file list stays within Phase 7.
- [x] `scripts/tasks.js`, `scripts/storage.js`, schema, export format, package files, and unrelated UI remain unchanged.

## Out of Scope

Direct priority, due-date, or description editing; drag-and-drop; manual reordering; backend/authentication/cloud sync; multi-tab synchronization; schema/storage-key/export changes; framework migration; generic notification system; full WCAG redesign; major refactor; and unrelated README or responsive redesign.
