# Phase 6 Undo Last Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one in-session Undo action for the most recently deleted task, preserving its complete task data and underlying array position while keeping persistence, filtering, sorting, and keyboard behavior predictable.

**Architecture:** Keep one pending deletion snapshot inside `scripts/tasks.js`, separate from the task array and storage schema. `scripts/app.js` owns the Undo message, button, save feedback, rendering, and focus behavior; the existing `scripts/storage.js` APIs remain responsible for persistence and should not need changes.

**Tech Stack:** Existing HTML5, CSS3, vanilla JavaScript ES modules, Node.js ESM tests, Playwright Test with Chromium, and the existing local HTTP test server. No new dependency or runtime dependency.

**Spec:** Approved Phase 6 Undo Last Delete design in the user-approved brainstorming conversation. No separate design spec file exists; do not create one during execution.

## Global Constraints

- Preserve responsibilities: `scripts/tasks.js` owns task state and task operations; `scripts/storage.js` owns persistence and export/restore validation; `scripts/app.js` owns UI, events, rendering, and coordination.
- Preserve `deleteTask(taskId)`'s current boolean return contract; successful deletion additionally replaces the pending snapshot.
- Add only the bounded state APIs `getPendingDeleteUndo()` and `undoLastDelete()` unless repository evidence requires a different minimal interface. `getPendingDeleteUndo()` returns a defensive copy or `null`; `undoLastDelete()` returns the restored task copy or `null`.
- The snapshot is one in-memory `{ task, index }` record. It is not persisted, exported, attached to a task, or retained across reload.
- `setTasks(taskList)` clears the pending snapshot because it replaces the full dataset. Cancelled, invalid, or failed-to-save imports do not call `setTasks()` and must leave the snapshot intact.
- Preserve the current save contract: state mutates in memory before `saveCurrentTasks()`. If storage fails, retain the in-session result and clearly say it was not saved; consume a successful in-memory Undo snapshot so repeat activation cannot restore duplicates.
- Do not alter search, filters, sort, localStorage schema/key, export format/version, confirmation requirement, or task field semantics.
- A successful later delete replaces the snapshot; a cancelled or unsuccessful delete does not.
- Keep UI copy in English. Do not claim full WCAG compliance.
- Every behavior change follows RED → GREEN → relevant regression. Do not weaken a failing assertion without proving its expectation or setup is wrong.
- Use the existing `npm.cmd test` Playwright runner and HTTP test server. Do not load browser tests through `file://`.
- At execution time, first create/use an isolated worktree through the Superpowers git-worktree workflow. Do not implement directly on `master`; do not push or merge as part of this plan.
- Do not add undo history, a timer, recycle bin, generalized undo framework, test-only state injection, or unrelated refactoring.

## Review Focus

1. **Underlying order, not visible order:** deleting a middle task while filters/sort alter the board must snapshot its index in the unfiltered `tasks` array; `undoRestoresMiddleTaskAtOriginalUnderlyingIndex` and browser filter/sort tests protect this.
2. **Stale snapshot prevention:** a later confirmed delete replaces the old snapshot, `setTasks()` invalidates it, and a missing snapshot is a no-op; `deleteTwiceUndoRestoresOnlySecondTask`, `setTasksInvalidatesPendingDeleteUndo`, and `undoWithoutPendingSnapshotReturnsNull` protect this. ID-conflict handling remains defensive; do not add a test-only setter to manufacture impossible internal state.
3. **Persistence honesty:** delete/undo storage failures leave the current-session state coherent and never announce a saved success; `deleteSaveFailureKeepsUndoAvailableAndReportsNotSaved` and `undoSaveFailureRestoresInMemoryAndReportsNotSaved` protect this.
4. **Cancel and replacement semantics:** dismissing confirmation changes neither task state nor the prior pending snapshot; `cancelledDeletePreservesPreviousUndoSnapshot` protects this.
5. **Restore invalidation:** only successful, persisted restore replaces state and clears Undo; `successfulRestoreInvalidatesPendingDeleteUndo` and `failedOrCancelledRestorePreservesPendingDeleteUndo` protect this.
6. **Keyboard continuity:** keyboard delete keeps Phase 5 next/previous/heading recovery, keyboard Undo focuses the restored Edit control or the status fallback when filtered; `keyboardUndoFocusesRestoredTaskOrStatusFallback` protects this.
7. **Mouse behavior and discoverability:** mouse activation does not receive forced focus, while the action has a clear accessible name and live announcement; `mouseUndoDoesNotForceFocus` and `undoActionHasAccessibleNameAndLiveStatus` protect this.
8. **View compatibility:** search/filter/sort state remains unchanged and can continue hiding/repositioning the restored task; `undoPreservesActiveFilterAndSort` protects this.
9. **Schema and scope:** localStorage/export shape and Phase 1–5 behavior remain unchanged; existing portability, CRUD, focus, responsive, and full-suite tests protect this.

## File Responsibility Map

### Files to modify

- `scripts/tasks.js` — own the one pending deletion snapshot, preserve its task/index on successful delete, return defensive metadata, restore at the original bounded index, reject duplicate IDs defensively, and clear the snapshot in `setTasks()`.
- `scripts/app.js` — coordinate pending Undo UI with delete/undo actions, current save result, render/filter/sort behavior, successful restore invalidation, and keyboard-versus-mouse focus recovery. Keep the existing CRUD save flow.
- `index.html` — add a compact Undo notice with a polite status message and an Undo button, positioned near the task board.
- `styles/main.css` — style the notice/button consistently and allow wrapping at mobile widths; no broad redesign.
- `tests/tasks.spec.js` — state snapshot, exact fields/order, replacement, invalidation, no-op, and non-mutation tests.
- `tests/app.spec.js` — delete confirmation, Undo visibility/restoration, fields/order, cancel behavior, and normal persistence browser tests.
- `tests/focus.spec.js` — keyboard/pointer focus, accessible name, live status, and filtered fallback tests.
- `tests/portability.spec.js` — restore invalidation/preservation and reload interaction tests if those tests fit its existing helpers and responsibility.
- `README.md` — add Undo Last Delete to the feature list and manual smoke-test workflow only; do not rewrite verification documentation.

### Files expected to remain untouched

- `scripts/storage.js` — existing `saveTasks()` and storage key are sufficient; no schema or persistence API change is planned.
- `package.json`, `package-lock.json`, `playwright.config.js`, and `tests/support/static-server.js` — Phase 5 test infrastructure is already present.
- Export envelope/version and task schema — Undo metadata is session-only and is not task data.
- Responsive layout outside the minimal Undo notice styles — no unrelated responsive redesign.

## Task Decomposition

### Task 1: Add one-level Undo state to the task owner

**Files:**
- Modify: `scripts/tasks.js`
- Test: `tests/tasks.spec.js`

**Interfaces:**
- Consumes: existing `setTasks(taskList)`, `getTasks()`, and `deleteTask(taskId)` APIs.
- Produces: `getPendingDeleteUndo() -> { task, index } | null` returning defensive copies; `undoLastDelete() -> task | null` restoring at the saved underlying index and consuming the snapshot on success. Keep `deleteTask(taskId) -> boolean` unchanged for existing callers.

- [ ] **Step 1: Write failing state tests** in `tests/tasks.spec.js`:
  - `deleteTaskCreatesSnapshotWithExactTaskAndUnderlyingIndex` asserts deletion of a middle task leaves the others in order and exposes the exact original task fields and index.
  - `undoRestoresFirstMiddleAndLastTaskAtOriginalIndex` runs first, middle, and last positions and asserts the full ordered array after Undo.
  - `deleteTwiceUndoRestoresOnlySecondTask` asserts a second successful delete replaces the pending snapshot.
  - `undoConsumesSnapshotAndSecondUndoIsNoOp` asserts the first Undo returns the restored task, the second returns `null`, and state has no duplicate.
  - `deleteUnknownIdDoesNotReplacePendingUndo` asserts a missing ID returns `false` and leaves the prior snapshot intact.
  - `setTasksInvalidatesPendingDeleteUndo` asserts replacing the full task list makes Undo return `null`.
  - `undoWithoutPendingSnapshotReturnsNull` asserts empty/reset state has no effect.
  - `createAndUpdateDoNotMutatePendingDeleteSnapshot` asserts a copy of a deleted task remains unchanged after creating or editing another task.
  - `undoRejectsPendingTaskIdAlreadyPresent` asserts no duplicate is inserted if a conflicting ID is encountered through a supported state setup; if the existing public API makes this state unreachable because `setTasks()` invalidates the snapshot, record that in the test/task ruling and do not add test-only injection.
- [ ] **Step 2: Run the focused tests and confirm RED**

  Run: `npm.cmd test -- tests/tasks.spec.js -g "deleteTaskCreatesSnapshot|undoRestoresFirstMiddleAndLast|deleteTwiceUndoRestoresOnlySecond|undoConsumesSnapshot|deleteUnknownIdDoesNotReplacePendingUndo|setTasksInvalidatesPendingDeleteUndo|undoWithoutPendingSnapshot|createAndUpdateDoNotMutatePendingDeleteSnapshot"`

  Expected: FAIL because the pending snapshot APIs/behavior do not exist yet. If the conflict test cannot construct the state through public APIs, omit only that impossible setup test and retain the defensive guard in review; do not introduce a test seam.
- [ ] **Step 3: Implement the minimum state behavior** in `scripts/tasks.js`:
  - Add one module-private pending snapshot variable separate from `tasks`.
  - In `deleteTask`, copy the found task and capture its index before `splice`; replace the snapshot only when the ID exists.
  - Implement `getPendingDeleteUndo()` as a defensive copy so UI/tests cannot mutate internal snapshot state.
  - Implement `undoLastDelete()` to return `null` without a snapshot; reject and consume a malformed snapshot or task ID conflict without inserting; otherwise clamp the saved index to `tasks.length`, splice in a task copy, consume the snapshot, and return a copy.
  - Clear the snapshot from `setTasks()` before/while replacing the list.
  - Do not change behavior of create, update, filtering, sorting, or task schema.
- [ ] **Step 4: Run focused state tests and confirm GREEN**

  Run: `npm.cmd test -- tests/tasks.spec.js -g "deleteTaskCreatesSnapshot|undoRestoresFirstMiddleAndLast|deleteTwiceUndoRestoresOnlySecond|undoConsumesSnapshot|deleteUnknownIdDoesNotReplacePendingUndo|setTasksInvalidatesPendingDeleteUndo|undoWithoutPendingSnapshot|createAndUpdateDoNotMutatePendingDeleteSnapshot"`

  Expected: PASS for the new assertions and existing selected state tests.
- [ ] **Step 5: Run task-state regression**

  Run: `npm.cmd test -- tests/tasks.spec.js`

  Expected: PASS for all task operation, date, filter, sort, and mutation safety tests.
- [ ] **Step 6: Commit Task 1**

  ```sh
  git add scripts/tasks.js tests/tasks.spec.js
  git commit -m "feat: add one-level task deletion undo state"
  ```

### Task 2: Add Undo notice and basic delete/restore UI flow

**Files:**
- Modify: `index.html`, `scripts/app.js`, `styles/main.css`
- Modify: `tests/app.spec.js`
- Consume: Task 1 APIs in `scripts/tasks.js`

**Interfaces:**
- Consumes: `getPendingDeleteUndo()` and `undoLastDelete()` from Task 1; existing `saveCurrentTasks()`, `renderDashboard()`, and task action focus helpers.
- Produces: a visible `#undo-delete-notice`, polite `#undo-delete-message`, and `#undo-delete-button` whose accessible name identifies the deleted task; confirmation copy that no longer says deletion cannot be undone.

- [ ] **Step 1: Write failing browser tests** in `tests/app.spec.js`:
  - `confirmedDeleteShowsUndoAndKeepsDeleteConfirmation` asserts confirmation is still requested, accepted delete removes the card and storage entry, notice/button become visible, and the English message identifies the deleted task.
  - `cancelledDeletePreservesTaskAndPreviousUndoSnapshot` deletes one task, dismisses confirmation for another, then asserts the first Undo remains available and restores only the first task.
  - `undoRestoresExactTaskFieldsAndUnderlyingOrder` seeds multiple tasks with distinct fields, deletes a middle task, activates Undo, and asserts all field values and storage array order are restored.
  - `secondConfirmedDeleteReplacesVisibleUndoTarget` deletes two tasks in succession and asserts Undo restores only the second task; the first remains deleted.
  - `undoButtonHasTaskSpecificAccessibleNameAndLiveMessage` asserts the button name identifies the task and the status element has `role="status"`/`aria-live="polite"`.
- [ ] **Step 2: Run the focused browser tests and confirm RED**

  Run: `npm.cmd test -- tests/app.spec.js -g "confirmedDeleteShowsUndo|cancelledDeletePreservesTaskAndPreviousUndoSnapshot|undoRestoresExactTaskFieldsAndUnderlyingOrder|secondConfirmedDeleteReplacesVisibleUndoTarget|undoButtonHasTaskSpecificAccessibleNameAndLiveMessage"`

  Expected: FAIL because the Undo controls and app handler do not exist yet.
- [ ] **Step 3: Add the minimal markup and styles**

  Modify `index.html` to place one hidden compact notice near the task board with a separate polite live-region message and a button. Keep button copy in English and ensure dynamic task title is set as text/accessible name, not HTML. Modify `styles/main.css` only for notice spacing, wrapping, and consistency with existing buttons/status boxes; do not redesign the board.
- [ ] **Step 4: Implement basic app coordination** in `scripts/app.js`

  On accepted delete, retain the existing confirmation and keyboard focus recovery, call `deleteTask`, save the current array, then render a notice from `getPendingDeleteUndo()`. Update the confirmation text so it does not claim deletion is irreversible. On Undo button activation, call `undoLastDelete()`, save current tasks, render the unchanged current view, and hide/consume the notice. Preserve delete cancellation so it neither calls delete nor overwrites the prior notice/snapshot. Do not force focus in this task; Task 4 owns focus-specific behavior.
- [ ] **Step 5: Run focused browser tests and confirm GREEN**

  Run: `npm.cmd test -- tests/app.spec.js -g "confirmedDeleteShowsUndo|cancelledDeletePreservesTaskAndPreviousUndoSnapshot|undoRestoresExactTaskFieldsAndUnderlyingOrder|secondConfirmedDeleteReplacesVisibleUndoTarget|undoButtonHasTaskSpecificAccessibleNameAndLiveMessage"`

  Expected: PASS; task fields/order, confirmation, notice, and replacement behavior match assertions.
- [ ] **Step 6: Run app regression**

  Run: `npm.cmd test -- tests/app.spec.js`

  Expected: PASS for existing CRUD, confirmation, filtering, sorting, and persistence behavior.
- [ ] **Step 7: Commit Task 2**

  ```sh
  git add index.html scripts/app.js styles/main.css tests/app.spec.js
  git commit -m "feat: add last-delete undo control"
  ```

### Task 3: Make Undo persistence outcomes explicit

**Files:**
- Modify: `scripts/app.js`, `tests/app.spec.js`
- Modify only if needed: `tests/portability.spec.js`
- Expected unchanged: `scripts/storage.js`

**Interfaces:**
- Consumes: Task 2 delete/Undo handlers and existing `saveCurrentTasks() -> boolean` behavior.
- Produces: user-visible delete/Undo copy that accurately reflects successful or failed persistence; no “saved” success claim after a failed write.

- [ ] **Step 1: Write failing persistence browser tests**:
  - Add `deleteSaveFailureKeepsUndoAvailableAndReportsNotSaved` to `tests/app.spec.js`. Block `Storage.prototype.setItem` for `STORAGE_KEY`, delete a seeded task, assert the task is removed in this page session, Undo remains available, saved storage remains unchanged, and message explicitly says the delete was not saved/session-only.
  - Add `undoSaveFailureRestoresInMemoryAndReportsNotSaved` to `tests/app.spec.js`. Let the delete write succeed first, then enable a test-controlled `Storage.prototype.setItem` failure before activating Undo; assert the task returns in rendered state, persisted storage still reflects the deletion, Undo is consumed, and the message says the restoration could not be saved/may not survive reload. Keep the failure toggle in the browser test setup; do not add production test hooks.
- [ ] **Step 2: Run the focused persistence tests and confirm RED**

  Run: `npm.cmd test -- tests/app.spec.js -g "deleteSaveFailureKeepsUndoAvailableAndReportsNotSaved|undoSaveFailureRestoresInMemoryAndReportsNotSaved"`

  Expected: FAIL because current delete/Undo notice does not yet distinguish save failure.
- [ ] **Step 3: Implement result-aware messaging** in `scripts/app.js`

  Use the boolean from `saveCurrentTasks()` for both delete and Undo. Keep the in-memory operation and snapshot semantics from the approved design. On failed delete save, leave Undo available and state that deletion is only in this session/not saved. On failed Undo save, keep the restored task in memory, consume the one-level snapshot, hide the Undo action, and state that restoration was not saved and may be lost after reload. On successful writes, use concise success copy. Do not change `saveCurrentTasks()` or storage format unless a test proves its existing result is insufficient.
- [ ] **Step 4: Run focused persistence tests and confirm GREEN**

  Run: `npm.cmd test -- tests/app.spec.js -g "deleteSaveFailureKeepsUndoAvailableAndReportsNotSaved|undoSaveFailureRestoresInMemoryAndReportsNotSaved"`

  Expected: PASS; no failed write is described as saved.
- [ ] **Step 5: Run persistence and portability regression**

  Run: `npm.cmd test -- tests/app.spec.js tests/portability.spec.js tests/storage.spec.js`

  Expected: PASS, including existing failed-restore atomicity and storage behavior.
- [ ] **Step 6: Commit Task 3**

  ```sh
  git add scripts/app.js tests/app.spec.js tests/portability.spec.js
  git commit -m "fix: report undo persistence failures accurately"
  ```

### Task 4: Preserve keyboard and pointer focus behavior

**Files:**
- Modify: `scripts/app.js`, `index.html` only if focus fallback markup requires it
- Modify: `tests/focus.spec.js`

**Interfaces:**
- Consumes: Task 2 notice/button and Task 1 state APIs.
- Produces: keyboard Undo focus recovery to restored task Edit when visible, status fallback when hidden, and no forced focus for pointer activation. Existing keyboard delete recovery remains unchanged.

- [ ] **Step 1: Write failing focus/accessibility tests** in `tests/focus.spec.js`:
  - `keyboardUndoFocusesRestoredTaskEditButton` keyboard-activates Undo and asserts focus lands on the restored task's Edit button.
  - `keyboardUndoUsesStatusFallbackWhenRestoredTaskIsFilteredOut` deletes a visible task, changes the filter so the task no longer matches, then keyboard-activates Undo; assert the filter remains unchanged, task remains hidden, and the status message is the focused fallback.
  - `mouseUndoDoesNotForceFocus` activates Undo by pointer and asserts app code did not move focus to the restored Edit control or status fallback.
  - Reuse Task 2's `undoButtonHasTaskSpecificAccessibleNameAndLiveMessage` for the accessible name/live-region assertions; do not duplicate that test here.
  - Retain existing `deleteKeyboardFocusesNextVisibleTaskEditButton`, `deleteLastVisibleTaskFallsBackToPreviousEditButton`, `deleteFromOnlyTaskFocusesColumnHeading`, `cancelDeleteReturnsFocusToDeleteTrigger`, and `mouseActionsDoNotForceKeyboardFocusTargets` as regression tests.
- [ ] **Step 2: Run the focused tests and confirm RED**

  Run: `npm.cmd test -- tests/focus.spec.js -g "keyboardUndoFocusesRestoredTaskEditButton|keyboardUndoUsesStatusFallbackWhenRestoredTaskIsFilteredOut|mouseUndoDoesNotForceFocus"`

  Expected: FAIL where Undo focus transitions are not implemented; existing focus tests remain characterization/regression coverage.
- [ ] **Step 3: Implement minimal focus handling** in `scripts/app.js`

  Detect keyboard activation using the existing `event.detail === 0` and `:focus-visible` approach. For keyboard Undo, after render locate the restored task's Edit button using a safe `data-task-id` lookup; focus it if present. If active filters hide the task, focus the programmatically focusable live status message. For pointer activation, do not call `focus()`. Do not add focus calls to general render paths. Keep delete focus selection logic intact.
- [ ] **Step 4: Run focused tests and confirm GREEN**

  Run: `npm.cmd test -- tests/focus.spec.js -g "keyboardUndoFocusesRestoredTaskEditButton|keyboardUndoUsesStatusFallbackWhenRestoredTaskIsFilteredOut|mouseUndoDoesNotForceFocus"`

  Expected: PASS with predictable keyboard targets and no app-forced pointer focus.
- [ ] **Step 5: Run all focus regression tests**

  Run: `npm.cmd test -- tests/focus.spec.js`

  Expected: PASS for all existing Phase 5 focus behavior and the new Undo cases.
- [ ] **Step 6: Commit Task 4**

  ```sh
  git add scripts/app.js index.html tests/focus.spec.js
  git commit -m "fix: preserve focus through delete undo"
  ```

### Task 5: Verify invalidation, view interactions, reload, and failure edges

**Files:**
- Modify: `tests/app.spec.js`, `tests/portability.spec.js`, and `tests/focus.spec.js` only where ownership fits
- Modify production files only if a RED test identifies an in-scope defect: `scripts/tasks.js`, `scripts/app.js`, `index.html`, or `styles/main.css`

**Interfaces:**
- Consumes: Task 1 state API and Tasks 2–4 UI/persistence/focus behavior.
- Produces: browser regression proof for view independence, snapshot invalidation, reload boundaries, and double activation.

- [ ] **Step 1: Add failing or characterization tests for remaining user-visible cases**:
  - `undoPreservesActiveFilterAndSort` in `tests/app.spec.js`: activate a status/search filter and sort, delete and undo a matching task, then assert controls remain unchanged, underlying storage order is restored, and visible order follows the active sort.
  - `undoKeepsRestoredTaskHiddenWhenItDoesNotMatchFilter` in `tests/app.spec.js`: delete the task with no excluding filter, then apply a filter that excludes it before Undo; assert it is restored in storage/state but remains absent from cards and the filter is unchanged; clear the filter and assert it appears.
  - `successfulRestoreInvalidatesPendingDeleteUndo` in `tests/portability.spec.js`: delete a task, successfully restore another dataset, assert Undo disappears and cannot reintroduce the deleted task.
  - `failedOrCancelledRestorePreservesPendingDeleteUndo` in `tests/portability.spec.js`: with Undo pending, test cancelled restore and failed persistence; assert the current dataset/snapshot remain and Undo still works. Invalid JSON should also leave the pending action intact if practical without duplicating existing invalid-file tests.
  - `deleteThenReloadDoesNotRetainUndoSnapshot` in `tests/app.spec.js`: persist delete, reload, assert Undo is absent and task remains deleted.
  - `undoThenReloadRetainsRestoredTask` in `tests/app.spec.js`: delete and successfully Undo, reload, assert task persists and Undo is absent.
  - `doubleUndoActivationDoesNotDuplicateTask` in `tests/app.spec.js`: activate once, then attempt a second activation through the stale locator or keyboard sequence; assert exactly one task and one stored ID.
  - `undoIndexBeyondCurrentLengthClampsToEnd` in `tests/tasks.spec.js` only if the state API can reach this state through supported operations without test-only mutation; otherwise verify the clamp in the implementation review and do not add a seam.
- [ ] **Step 2: Run focused tests and confirm RED where behavior is new**

  Run: `npm.cmd test -- tests/app.spec.js tests/portability.spec.js tests/tasks.spec.js -g "undoPreservesActiveFilterAndSort|undoKeepsRestoredTaskHiddenWhenItDoesNotMatchFilter|successfulRestoreInvalidatesPendingDeleteUndo|failedOrCancelledRestorePreservesPendingDeleteUndo|deleteThenReloadDoesNotRetainUndoSnapshot|undoThenReloadRetainsRestoredTask|doubleUndoActivationDoesNotDuplicateTask|undoIndexBeyondCurrentLengthClampsToEnd"`

  Expected: new UI/state tests fail only for missing approved behavior; already-correct canceled restore or reload behavior may pass as characterization tests. Record the actual reason for every initial result rather than changing valid expectations to force RED.
- [ ] **Step 3: Make only targeted fixes**

  Change only the production function/handler that the failing assertion identifies. Successful restore already calls `setTasks()`, which must clear Undo; cancelled/invalid/failed restore must not call it. Do not reset filter/sort on Undo. Preserve exact task array ordering and the existing persisted schema.
- [ ] **Step 4: Run focused edge tests and confirm GREEN**

  Run: `npm.cmd test -- tests/app.spec.js tests/portability.spec.js tests/tasks.spec.js -g "undoPreservesActiveFilterAndSort|undoKeepsRestoredTaskHiddenWhenItDoesNotMatchFilter|successfulRestoreInvalidatesPendingDeleteUndo|failedOrCancelledRestorePreservesPendingDeleteUndo|deleteThenReloadDoesNotRetainUndoSnapshot|undoThenReloadRetainsRestoredTask|doubleUndoActivationDoesNotDuplicateTask|undoIndexBeyondCurrentLengthClampsToEnd"`

  Expected: all applicable new tests pass; tests intentionally omitted as unreachable are documented in the ruling/commit notes.
- [ ] **Step 5: Run relevant regression suites**

  Run: `npm.cmd test -- tests/tasks.spec.js tests/app.spec.js tests/portability.spec.js tests/focus.spec.js`

  Expected: all state, CRUD, restore, persistence, and focus tests pass.
- [ ] **Step 6: Commit Task 5**

  ```sh
  git add scripts/tasks.js scripts/app.js index.html styles/main.css tests/tasks.spec.js tests/app.spec.js tests/portability.spec.js tests/focus.spec.js
  git commit -m "test: cover undo invalidation and view edge cases"
  ```

### Task 6: Document Undo and run full regression review

**Files:**
- Modify: `README.md`
- Verify: all project files; no additional production edits unless a Critical/Important in-scope defect is found and fixed with RED → GREEN.

**Interfaces:**
- Consumes: completed Undo behavior and current verification commands documented by Phase 5.
- Produces: accurate English feature/manual-smoke documentation and a verified branch with all Phase 1–5 regressions passing.

- [ ] **Step 1: Update the README feature list and manual smoke test**

  Add one concise feature bullet for Undo of the last deletion during the current page session. Add a quick manual step: create multiple tasks, delete one and confirm, use Undo, verify all fields and order return; reload and verify Undo itself is no longer available. Do not imply Undo history persists across reload. Preserve the existing test, responsive, HTTP, and troubleshooting instructions.
- [ ] **Step 2: Review README changes**

  Run: `git diff --check`

  Expected: no whitespace errors; README commands and app-facing copy remain in English.
- [ ] **Step 3: Run full automated regression**

  Run: `npm.cmd test`

  Expected: all pre-existing 55 tests and all new tests pass in Chromium; no test depends on leaked localStorage or `file://`.
- [ ] **Step 4: Run syntax and scope checks**

  Run each command from the repository root:

  - `node --check scripts/app.js`
  - `node --check scripts/tasks.js`
  - `node --check scripts/storage.js`

  Expected: all JavaScript syntax checks pass. Also inspect `git diff --check`, dependency diff, task/export schema, and changed-file list; expected runtime dependencies remain zero, storage/export formats remain unchanged, and changes stay within Phase 6.
- [ ] **Step 5: Review test coverage and responsive impact**

  Run: `npm.cmd test -- tests/responsive.spec.js`

  Expected: existing desktop 1440x900, tablet 768x1024, and mobile 375x812 checks pass with the Undo notice/button inside viewport bounds. If a concrete failure is reproduced, add a targeted regression assertion, make the smallest CSS fix, and rerun the responsive suite plus `npm.cmd test`; otherwise leave responsive styling unchanged beyond the notice.
- [ ] **Step 6: Perform fresh whole-branch review**

  Inspect the complete branch diff and verify: one-level-only snapshot; original underlying order; new-delete replacement; cancel preservation; restore invalidation; no invalidation for create/edit/filter/sort/export; honest save-failure messages; double-Undo no-op; keyboard/pointer focus behavior; accessible name/live status; no `storage.js`, schema, export-format, dependency, or out-of-scope changes. Fix any Critical/Important in-scope issue with RED → GREEN and rerun relevant tests plus full suite. Record unreachable defensive cases without creating test-only interfaces.
- [ ] **Step 7: Commit documentation and final verified state**

  ```sh
  git add README.md
  git commit -m "docs: explain last-delete undo behavior"
  ```

  If the final review required a separate behavior fix, commit that fix separately with a meaningful message after its tests pass; do not amend or squash task commits.

## Execution Notes

- This plan is planning output only. Do not create a worktree, edit application/test files, run implementation tests, commit, or push while authoring/reviewing the plan.
- During execution, use the approved isolated-worktree workflow, maintain an execution ledger, complete tasks in order, and commit each task separately.
- Full-suite success must be reported from actual execution output; the planning stage makes no claim that new tests pass.
