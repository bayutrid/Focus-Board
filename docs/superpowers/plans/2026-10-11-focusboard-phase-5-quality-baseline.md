# Quality Baseline and Keyboard Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repeatable Chromium tests, predictable keyboard focus after task actions, responsive layout checks, and an English verification workflow without adding product features or runtime dependencies.

**Architecture:** Keep `tasks.js`, `storage.js`, and `app.js` responsibilities intact. Use Playwright Test as the only test runner; unit tests exercise task and storage modules, while browser tests run the existing app over a small Node built-in HTTP server. Change `app.js`, `index.html`, or `main.css` only for a failing, in-scope browser behavior; leave responsive CSS unchanged if viewport checks pass.

**Tech Stack:** Existing HTML/CSS/vanilla JavaScript ES modules; Node.js 24+; npm; one development-only `@playwright/test` dependency; Chromium; Node built-in `http`, `fs`, and `path` modules for the local test/application server. No runtime dependencies, framework, bundler, or TypeScript.

**Spec:** User-approved “Quality Baseline and Keyboard Interaction” design in the conversation. No separate spec document exists; do not create one for this phase.

## Global Constraints

- Preserve runtime responsibilities: `scripts/tasks.js` owns task state/operations, `scripts/storage.js` owns persistence/validation/export/restore, and `scripts/app.js` owns UI/rendering/interaction/coordination.
- Add exactly one test dependency, `@playwright/test`, as a development dependency; commit `package-lock.json` so a fresh checkout can use `npm ci`.
- Configure one Playwright project using Chromium. Resolve a current stable `@playwright/test` release compatible with Node 24 at execution time; let the lockfile pin the exact resolved version rather than hard-coding an unverified version in this plan.
- Use an HTTP origin for all browser tests; never load `index.html` through `file://`.
- The test server must use Node built-ins and serve only the repository root. It must return correct HTML, JavaScript-module, and CSS content types, return 404 for missing files, and reject paths that resolve outside the root.
- Isolate browser tests: clear or seed the FocusBoard storage key before each test, and do not let one test's localStorage state leak into another.
- Use deterministic task fixtures and a fixed local `today` for due-date boundary assertions.
- Every production behavior change follows RED → GREEN → relevant regression → optional justified refactor. Characterization tests for existing behavior may pass on their first run; do not manufacture failures for already-working behavior.
- Do not weaken a failing assertion to make a test pass. Fix only confirmed, in-scope behavior with the smallest change.
- Keep all application and README text in English. The implementation report may be in Bahasa Indonesia.
- Do not add undo, product features, a visual redesign, CI/CD, a general refactor, a full WCAG audit, or screen-reader certification.
- Do not create a branch/worktree, commit, or push during planning. During later execution, follow the Superpowers worktree workflow before editing production files.

## Review Focus

1. **ES module loading/configuration under Node:** `tests/tasks.spec.js` and `tests/storage.spec.js` must import the existing `.js` modules as ESM under the declared package configuration; Task 1 smoke test and Tasks 2–3 protect this.
2. **Browser tests accidentally using `file://`:** `appLoadsOverHttpWithoutConsoleErrors` must assert an `http:` origin and successful module/CSS responses; Task 1 protects this.
3. **localStorage leaking between tests:** every browser test starts with a cleared or explicitly seeded `focusboard.tasks.v1`; Task 4 and Task 5 fixtures protect this, with reload persistence tested within a single isolated test.
4. **Focus disappearing after a rerender:** keyboard tests assert the active element after edit cancellation, deletion, Clear Filters, restore, and export; Task 6 owns these cases.
5. **Task moving columns or disappearing after an edit:** `saveWithStatusChangeKeepsFocusInFormWhenTaskMovesOrIsFilteredOut` changes status under an active due-date filter and asserts the edited task is updated while focus remains in the form; Task 6 protects this.
6. **Unsafe focus lookup for restored task IDs:** `deleteWithQuotedTaskIdRestoresFocusWithoutSelectorErrors` uses a valid restored ID containing selector-special characters and confirms focus recovery uses task identity safely; Task 6 protects this.
7. **Responsive CSS changed without evidence:** viewport tests assert current expected layout at the three agreed widths; Task 7 requires leaving CSS untouched when all checks pass.
8. **Restore persistence failure partially replacing current data:** `failedRestorePersistenceKeepsMemoryAndSavedTasksUnchanged` forces `localStorage.setItem` to fail and verifies the current state remains intact; Task 5 protects this.

## File Responsibility Map

### Files to create

- `package.json` — declare ESM mode, Node engine requirement selected against the installed supported Node/Playwright versions, `test` and `serve` scripts, and the single development dependency.
- `package-lock.json` — exact reproducible development dependency graph generated by npm.
- `playwright.config.js` — discover tests, start/check the HTTP server, configure one Chromium project, and keep worker behavior deterministic for this small suite.
- `tests/support/static-server.js` — small Node built-in static HTTP server shared by the README local-run command and Playwright `webServer`; safe path resolution, MIME types, 404 handling, and configurable port.
- `tests/support/task-fixtures.js` — canonical valid task/export fixture helpers shared by unit and browser tests; keep helper surface small.
- `tests/smoke.spec.js` — HTTP/module-loading smoke test.
- `tests/tasks.spec.js` — task CRUD, date, filter, sort, and mutation-safety tests.
- `tests/storage.spec.js` — localStorage result states and export-envelope validation tests using an isolated fake storage object for module-level cases.
- `tests/app.spec.js` — browser CRUD, combined filtering/sorting, and task persistence tests.
- `tests/portability.spec.js` — browser export/download, restore confirmation, invalid-file, failed-write, and reload-persistence tests.
- `tests/focus.spec.js` — keyboard and pointer focus behavior tests.
- `tests/responsive.spec.js` — viewport geometry/overflow checks for 1440×900, 768×1024, and 375×812.

### Files to modify

- `scripts/app.js` — only the minimum focus-transition behavior needed by Task 6; retain current DOM, task, and storage ownership.
- `index.html` — only if column headings need `tabindex="-1"` as a programmatic fallback after keyboard deletion.
- `styles/main.css` — only if a concrete responsive test failure requires a targeted fix, or a programmatically focused column heading needs a visible focus indicator.
- `README.md` — add the English requirements, local HTTP server, test/browser setup, coverage, responsive checks, smoke test, and troubleshooting workflow.

### Files to leave untouched unless a specific failing test proves a defect

- `scripts/tasks.js` — current exports already expose task operations, due-date matching, sorting, and deterministic date input for direct tests.
- `scripts/storage.js` — current exports already expose localStorage access, validation, and JSON parsing/serialization for direct tests.
- `index.html` and `styles/main.css` remain untouched by responsive work if Task 7 passes without a concrete layout defect.
- Existing Phase 4 plan, task schema, storage key, localStorage shape, export envelope/version, and restore validation contract.

## Task Decomposition

### Task 1: Configure Playwright and the local HTTP server

**Files:**
- Create: `package.json`, `package-lock.json`, `playwright.config.js`
- Create: `tests/support/static-server.js`, `tests/smoke.spec.js`
- Modify: none
- Test: `tests/smoke.spec.js`

**Interfaces:**
- Consumes: existing `index.html`, `styles/main.css`, and `scripts/app.js`.
- Produces: `npm test`; `npm run serve`; Playwright `webServer` at `http://127.0.0.1:4173`; one Chromium project.
- The static server accepts `--port <number>` or `PORT`, defaults to port `4173`, binds to loopback, and serves repository-root files only.

1. [ ] Check `node --version`, `npm.cmd --version`, and the official Playwright package engine requirement. Use the available Node 24 environment as the validation baseline; document the minimum supported Node release only after confirming compatibility.
2. [ ] Create `tests/smoke.spec.js` with `appLoadsOverHttpWithoutConsoleErrors`. Assert `page.url()` uses `http:`, the `Your focus board` heading is visible, the app module and stylesheet return successful responses with the expected content types, and no uncaught page error is recorded.
3. [ ] Create `serverReturns404AndRejectsPathsOutsideRoot`. Assert a missing path returns 404 and a URL-encoded traversal request cannot return a file outside the repository root.
4. [ ] Create `tests/support/static-server.js` with a Node built-in HTTP server. Resolve decoded request paths against the repository root; reject traversal outside that root; serve `.html`, `.js`, and `.css` with correct MIME types; serve `/` as `index.html`; return 404 for missing files. Do not add a server dependency.
5. [ ] Create `package.json` with `"type": "module"`, `"test": "playwright test"`, `"serve": "node tests/support/static-server.js"`, the confirmed Node engine floor, and `@playwright/test` as the only dev dependency. Run `npm install --save-dev @playwright/test` to generate `package-lock.json`; do not add runtime dependencies.
6. [ ] Create `playwright.config.js` with `testDir: "./tests"`, one Chromium project, no parallel execution for the initial suite, base URL `http://127.0.0.1:4173`, and `webServer.command: "node tests/support/static-server.js --port 4173"`. Wait for the configured URL and reuse an existing server only outside CI.
7. [ ] Run `npm.cmd test -- tests/smoke.spec.js`. Expected: both smoke tests PASS; the browser reports HTTP module/CSS responses, no page errors, a 404 for a missing file, and rejection of traversal. On shells where npm shims work, `npm test -- tests/smoke.spec.js` is equivalent.
8. [ ] Verify `npm.cmd run serve -- --port 4174` starts the app on port 4174 and `GET /` returns `index.html` over HTTP.
9. [ ] Commit the tooling baseline: `git add package.json package-lock.json playwright.config.js tests/smoke.spec.js tests/support/static-server.js && git commit -m "test: configure Playwright and local HTTP server"`.

### Task 2: Add task-state characterization and regression tests

**Files:**
- Create: `tests/support/task-fixtures.js`, `tests/tasks.spec.js`
- Modify: none unless a concrete failing assertion proves a defect in `scripts/tasks.js`
- Test: `tests/tasks.spec.js`

**Interfaces:**
- Consumes: exports from `scripts/tasks.js`: `setTasks`, `getTasks`, `createTask`, `updateTask`, `deleteTask`, `getVisibleTasks`, `sortTasks`, `getDueDateStatus`.
- Produces: `makeTask(overrides = {})` with canonical valid fields and direct module tests. Reset module state with `setTasks([])` before each test.

1. [ ] Create a deterministic `makeTask()` fixture with all canonical fields and overridable `id`, `title`, `description`, `status`, `priority`, and `dueDate`. Use timestamps that pass `storage.js` validation.
2. [ ] Write `createTaskTrimsFieldsAndSetsDefaults`: assert generated ID is non-empty and unique across two calls; title/description are trimmed; default status/priority/dueDate are `todo`/`medium`/`null`; timestamps are parseable.
3. [ ] Write `updateTaskChangesEditableFieldsAndPreservesIdentity`: assert title, description, status, priority, dueDate, and `updatedAt` change while `id` and `createdAt` remain; write `updateTaskReturnsNullForUnknownId` and `deleteTaskReturnsFalseForUnknownId`.
4. [ ] Write `deleteTaskRemovesOnlyMatchingId`: seed three tasks, delete the middle ID, and assert the remaining task objects and order.
5. [ ] Write `getVisibleTasksMatchesSearchStatusPriorityAndDueDateTogether`: with fixed local today 2026-10-10, assert only the task matching all selected criteria is returned; include a near-match that fails each individual criterion.
6. [ ] Write `dueDateFiltersUseLocalBoundariesAndExcludeDoneTasks`: assert yesterday is Overdue, today is Due today, tomorrow and day 7 are Upcoming, day 8 is excluded, and Done tasks are excluded from Overdue/Today/Upcoming/No due date.
7. [ ] Write `noDueDateMatchesOnlyOpenTasksWithoutADueDate`: assert `null`/empty due dates match for Todo/Doing and not Done; due-dated tasks do not match.
8. [ ] Write `sortingIsStableAndDoesNotMutateInputOrder`: assert Due Date and Priority sorts produce exact expected stable ordering while source array and task objects remain unchanged.
9. [ ] Write `filteringAndCombinedSortingDoNotMutateTaskState`: snapshot full objects and order, apply combined filters followed by `sortTasks`, then deep-compare the source before and after.
10. [ ] Run `npm.cmd test -- tests/tasks.spec.js`. Expected: all characterization tests PASS against the current `tasks.js`. If one fails, retain the assertion, verify it represents the approved existing contract, then use a separate failing-test/minimal-fix/regression sequence in `scripts/tasks.js`; do not refactor unrelated logic.
11. [ ] Run `node --check scripts/tasks.js` and `npm.cmd test -- tests/tasks.spec.js`; expected: syntax check and all task tests PASS.
12. [ ] Commit: `git add tests/tasks.spec.js tests/support/task-fixtures.js scripts/tasks.js && git commit -m "test: cover task state and filtering behavior"` (omit `scripts/tasks.js` from `git add` when unchanged).

### Task 3: Add storage and export-envelope tests

**Files:**
- Create: `tests/storage.spec.js`
- Modify: none unless a concrete failing assertion proves a defect in `scripts/storage.js`
- Test: `tests/storage.spec.js`

**Interfaces:**
- Consumes: `STORAGE_KEY`, `validateTasks`, `saveTasks`, `loadTasks`, `serializeTaskExport`, and `parseTaskExport` from `scripts/storage.js`; `makeTask()` from Task 2.
- Produces: isolated storage tests that restore the original `globalThis.window` descriptor after each test.

1. [ ] Write `loadTasksReturnsMissingForAbsentKey` and `loadTasksReturnsLoadedForValidStoredTasks`; assert returned status and deep-equal task content.
2. [ ] Write `loadTasksDistinguishesCorruptJsonFromInvalidTaskShape`: malformed JSON returns `corrupt`; valid JSON with invalid task shape/duplicate IDs returns `invalid`; original saved bytes remain unchanged.
3. [ ] Write `loadTasksReturnsUnavailableWhenStorageReadThrows` and `saveTasksReturnsFailureWhenStorageWriteThrows`; assert no uncaught exception and the existing result objects.
4. [ ] Write `saveTasksPersistsCanonicalTaskArray`: assert one storage key, JSON task array, same order, and no export envelope in localStorage.
5. [ ] Write `serializeTaskExportUsesVersionOneAndCanonicalFields`: assert `format === "focusboard-tasks"`, `version === 1`, exact task field names, and stable task order.
6. [ ] Write `parseTaskExportAcceptsValidEnvelopeAndReturnsCopies`: assert parsed tasks equal fixture values but do not share object identity.
7. [ ] Write `parseTaskExportRejectsInvalidJsonAndUnsupportedEnvelope`: cover malformed JSON, unsupported version, wrong format, missing/extra envelope property, and non-array tasks.
8. [ ] Write `parseTaskExportRejectsInvalidTasksDuplicateIdsAndExtraFields`: cover invalid status/date/title, repeated IDs, missing canonical task field, and extra task field.
9. [ ] Run `npm.cmd test -- tests/storage.spec.js`. Expected: all tests PASS against the current `storage.js`. If a result differs, use a minimal scoped fix with a failing assertion first; preserve key/schema/export version.
10. [ ] Run `node --check scripts/storage.js` and `npm.cmd test -- tests/storage.spec.js`; expected: syntax check and all storage tests PASS.
11. [ ] Commit: `git add tests/storage.spec.js scripts/storage.js && git commit -m "test: cover storage and export validation"` (omit `scripts/storage.js` from `git add` when unchanged).

### Task 4: Add browser CRUD, filter, sort, and persistence regressions

**Files:**
- Create: `tests/app.spec.js`
- Modify: none unless an assertion proves a current in-scope behavior defect in `scripts/app.js`
- Test: `tests/app.spec.js`

**Interfaces:**
- Consumes: Playwright `page`, Task 1 HTTP server, current app UI, and `focusboard.tasks.v1`.
- Produces: browser tests using accessible labels/roles and task data IDs; each test clears storage before the app's first meaningful render.

1. [ ] Add a per-test fixture that opens a fresh browser context/page and clears `localStorage` before loading the app. Do not clear storage on every navigation, so persistence-across-reload tests remain meaningful.
2. [ ] Write `createTaskPersistsAllEnteredFieldsAcrossReload`: create a task with description, Doing, High, and a fixed due date; assert card text and stored fields, reload, then assert the card and counters remain correct.
3. [ ] Write `editTaskUpdatesTitleDescriptionStatusPriorityAndDueDate`: edit an existing task; assert updated card appears under the new status column, old values are absent, and the storage record is updated without changing task ID/createdAt.
4. [ ] Write `deleteConfirmationDeletesOnlyWhenAccepted`: accept confirmation and assert task removal/storage update; repeat in a separate isolated case with dismissed dialog and assert no task/storage change.
5. [ ] Write `filtersAndSortComposeWithoutChangingStoredTaskOrder`: seed several distinguishing tasks; combine Search, Status, Priority, Due Date, and Sort; assert exact visible cards, summary/count, counters based on all tasks, and unchanged `localStorage` order.
6. [ ] Write `clearFiltersResetsControlsWithoutChangingTasks`: activate every filter and non-default sorting; clear; assert default control values, full visible task list, and byte-equivalent storage.
7. [ ] Run `npm.cmd test -- tests/app.spec.js`. Expected: all existing Phase 1–4 behaviors pass. If an assertion finds a regression, fix only the failing existing flow with RED/GREEN and preserve storage/schema behavior.
8. [ ] Run `npm.cmd test -- tests/app.spec.js tests/tasks.spec.js`. Expected: browser and task-state suites PASS together without state leakage.
9. [ ] Commit: `git add tests/app.spec.js scripts/app.js && git commit -m "test: cover core browser task workflows"` (omit `scripts/app.js` when unchanged).

### Task 5: Add browser export and restore safety tests

**Files:**
- Create: `tests/portability.spec.js`
- Modify: none unless a concrete failing assertion proves an in-scope defect in `scripts/app.js` or `scripts/storage.js`
- Test: `tests/portability.spec.js`

**Interfaces:**
- Consumes: Task 1 server, Task 2 canonical fixtures, current export/restore controls, Playwright download/dialog/file APIs.
- Produces: end-to-end coverage for export contents and safe restore outcomes.

1. [ ] Write `exportDownloadsAllCanonicalTasksEvenWhenFiltered`: seed at least two tasks, activate a filter that displays one, trigger Export, parse the downloaded JSON, and assert both tasks, format/version 1, canonical field names, and original order.
2. [ ] Write `validRestoreReplacesTasksAndSurvivesReload`: upload a valid version-1 envelope, accept confirmation, assert replacement and success message, reload, and assert restored tasks remain.
3. [ ] Write `invalidJsonAndInvalidStructureDoNotChangeTasksOrStorage`: try malformed JSON and unsupported/invalid envelope; assert an error message and byte-identical old task storage after each attempt.
4. [ ] Write `restoreRejectsInvalidTaskDuplicateIdsAndExtraFields`: upload exports containing each invalid case; assert rejection and no replacement.
5. [ ] Write `cancelledRestoreKeepsCurrentTasksAndStorage`: dismiss confirmation for a valid file and assert current visible and saved tasks remain unchanged.
6. [ ] Write `failedRestorePersistenceKeepsMemoryAndSavedTasksUnchanged`: temporarily make `Storage.prototype.setItem` throw for `focusboard.tasks.v1`; accept valid restore; assert the current in-memory board and prior stored value remain and the failure message appears.
7. [ ] Write `restoreWhileFilteredResetsViewOnlyAfterSuccessfulReplacement`: start with active filters; cancel/submit invalid restore and assert filter/task state stays; then confirm valid restore and assert tasks replace and controls return to approved defaults.
8. [ ] Run `npm.cmd test -- tests/portability.spec.js`. Expected: PASS without changing the export envelope, task schema, confirmation rule, or storage-first restore behavior. For a failure, use a failing browser assertion before a minimum fix.
9. [ ] Run `npm.cmd test -- tests/portability.spec.js tests/storage.spec.js`. Expected: browser and storage portability tests PASS.
10. [ ] Commit: `git add tests/portability.spec.js scripts/app.js scripts/storage.js && git commit -m "test: cover browser export and restore safety"` (stage production files only if a verified in-scope fix was required).

### Task 6: Implement coherent keyboard focus recovery

**Files:**
- Create: `tests/focus.spec.js`
- Modify: `scripts/app.js`; modify `index.html` and `styles/main.css` only for focusable/visible empty-column fallback.
- Test: `tests/focus.spec.js`

**Interfaces:**
- Consumes: Task 1 browser config, Task 2 fixtures, Task 4/5 app helpers and stable `data-task-id` attributes.
- Produces: task-action focus behavior local to `app.js`; focusable column-heading fallback; no cross-module state API.

1. [ ] Write the tests before changing production behavior. Include these exact cases: `createRetainsFormFocus`, `editActionFocusesTitle`, `cancelEditReturnsKeyboardFocusToSameEditTrigger`, `cancelEditFallsBackToTitleWhenOriginalTriggerIsGone`, `saveWithStatusChangeKeepsFocusInFormWhenTaskMovesOrIsFilteredOut`, `deleteKeyboardFocusesNextVisibleTaskEditButton`, `deleteLastVisibleTaskFallsBackToPreviousEditButton`, `deleteFromOnlyTaskFocusesColumnHeading`, `cancelDeleteReturnsFocusToDeleteTrigger`, `filtersAndSortRetainFocusOnTheirControls`, `clearFiltersRetainsFocusOnClearButton`, `restoreRetainsFocusOnRestoreControl`, `exportRetainsFocusOnExportButton`, and `mouseActionsDoNotForceKeyboardFocusTargets`.
2. [ ] Add `deleteWithQuotedTaskIdRestoresFocusWithoutSelectorErrors`: restore a task whose valid ID contains quotes/brackets, focus its Delete action by keyboard, confirm, and assert focus recovery succeeds without selector parsing errors.
3. [ ] Run `npm.cmd test -- tests/focus.spec.js`. Expected RED only for existing missing behavior: Cancel Edit focus recovery, confirmed Delete recovery, and Clear Filters forcing focus to Search; the focused-submit case may also expose focus loss because the current handler disables the submit button. Record exact failures. Existing edit-to-title and stable-control cases should pass.
4. [ ] In `scripts/app.js`, implement a small action-specific focus policy: retain focus when the active element remains connected and relevant; recover only when a keyboard-visible action removes it. Use `:focus-visible` before the transition to distinguish keyboard focus; do not force focus for pointer actions.
5. [ ] For Cancel Edit, capture the editing task ID before reset; after reset, focus its current Edit trigger only when the trigger had keyboard-visible focus. If it no longer exists, focus `#task-title`.
6. [ ] For Delete, before mutation capture the visible task IDs/order in that status column and whether the Delete trigger matches `:focus-visible`. After confirmed deletion/render, focus the next visible task's Edit action, otherwise the previous visible task's Edit action, otherwise that column's heading. Do not construct CSS selectors by interpolating task IDs; compare `dataset.taskId` values safely.
7. [ ] For an empty-column fallback, add `tabindex="-1"` to the three column headings in `index.html` and add a visible focus style in `styles/main.css` only if needed to keep programmatic focus perceivable. `tabindex="-1"` must not add headings to normal Tab order.
8. [ ] Remove the unconditional `searchInput.focus()` from the Clear Filters handler. Preserve focus on the existing Clear button.
9. [ ] Ensure a keyboard-activated submit that disables the focused submit button does not lose focus: retain the submit control's focus through the synchronous save/render/reset flow, using the existing `isSubmitting` guard as appropriate. Do not move focus to the board after Save, including when the task changes columns or is filtered out.
10. [ ] Leave focus unchanged for search/status/priority/due-date controls, Sort, Restore, and Export. Confirm Create leaves focus in its existing form submit flow. Do not add global focus calls to `renderDashboard()`.
11. [ ] Run focused RED/GREEN loop: `npm.cmd test -- tests/focus.spec.js -g "cancelEdit|saveWithStatusChange|deleteKeyboard|deleteLast|deleteFromOnly|cancelDelete|clearFilters|quotedTaskId|mouseActions"`. Expected after implementation: all selected focus regressions PASS.
12. [ ] Run `npm.cmd test -- tests/focus.spec.js`. Expected: all focus cases PASS, including Restore/Export retention and no focus change for ordinary pointer activation.
13. [ ] Run `npm.cmd test -- tests/app.spec.js tests/portability.spec.js tests/focus.spec.js` and `node --check scripts/app.js`. Expected: browser behavior and focus suites PASS; syntax check succeeds.
14. [ ] Commit: `git add tests/focus.spec.js scripts/app.js index.html styles/main.css && git commit -m "fix: preserve keyboard focus across task actions"` (omit unchanged files).

### Task 7: Add responsive browser verification and evidence-based fixes

**Files:**
- Create: `tests/responsive.spec.js`
- Modify: `styles/main.css` and/or `index.html` only if a reproducible failure requires a targeted fix.
- Test: `tests/responsive.spec.js`

**Interfaces:**
- Consumes: Task 1 Chromium server and current responsive markup/styles.
- Produces: one test per viewport and explicit geometry assertions; no CSS change if all tests pass.

1. [ ] Write `desktop1440x900HasNoOverflowAndThreeBoardColumns`, `tablet768x1024HasNoOverflowAndExpectedBoardColumns`, and `mobile375x812HasNoOverflowAndStackedBoardColumns` before any responsive style edit.
2. [ ] At each viewport assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; all filter controls, Clear Filters, form, portability controls, status messages, and cards stay inside the viewport; primary controls remain visible and operable; task columns render three across at desktop/tablet and one across on mobile.
3. [ ] Seed one task in each status column so card geometry is checked, not only empty-state geometry. Assert card and message text boxes stay within their column bounds.
4. [ ] Run `npm.cmd test -- tests/responsive.spec.js`. Expected: either all pass with no production layout change, or a specific viewport/element assertion fails and identifies the defect.
5. [ ] If all pass, leave `styles/main.css` and responsive markup unchanged. If a concrete failure occurs, document the viewport and measured overflow/boundary, then use the failing assertion as RED and make the smallest targeted CSS/markup fix; re-run the exact failing test to GREEN.
6. [ ] Run `npm.cmd test -- tests/responsive.spec.js tests/focus.spec.js`. Expected: responsive and focus styles work together and all cases pass.
7. [ ] Commit: if tests alone changed, `git add tests/responsive.spec.js && git commit -m "test: verify responsive layouts"`; if a targeted production fix was needed, use `git add tests/responsive.spec.js styles/main.css index.html && git commit -m "fix: correct verified responsive layout issue"` (stage only changed files).

### Task 8: Document verification workflow and run the full regression suite

**Files:**
- Modify: `README.md`
- Test: all files under `tests/`

**Interfaces:**
- Consumes: actual scripts/config/Node server from Tasks 1–7.
- Produces: beginner-friendly English instructions whose commands match the checked-in package scripts and server implementation.

1. [ ] Update README with sections: `Requirements`, `Run the app`, `Why HTTP instead of file://`, `Install test tooling`, `Install Chromium`, `Run automated tests`, `Test coverage`, `Responsive verification`, `Quick manual smoke test`, and `Troubleshooting`.
2. [ ] Document actual commands: `npm ci`, `npx playwright install chromium`, `npm test`, and `npm run serve` (plus port override only if the server supports it). Explain that PowerShell execution-policy environments may need `npm.cmd`/`npx.cmd`; do not claim commands that the package scripts do not provide.
3. [ ] Document the exact viewport sizes and assertions; give a short manual keyboard smoke path covering edit, cancel, save/status change, delete/cancel delete, Clear Filters, restore, and export. Keep website and README copy in English.
4. [ ] Review README commands against `package.json`, `playwright.config.js`, and `tests/support/static-server.js`; run the HTTP app locally using `npm.cmd run serve` and confirm `http://127.0.0.1:4173` works.
5. [ ] From the project root, run `npm.cmd ci`; expected: lockfile installs without modifying package manifests. Run `npx.cmd playwright install chromium`; expected: Chromium is available. Run `npm.cmd test`; expected: all task, storage, UI, focus, portability, and responsive tests pass.
6. [ ] Run `node --check scripts/tasks.js`, `node --check scripts/storage.js`, `node --check scripts/app.js`, `node --check tests/support/static-server.js`, and `git diff --check`; expected: all syntax checks and whitespace check pass.
7. [ ] Inspect `git status --short` and `git diff --stat`; expected changes are only this phase's package/test/server/focus/documentation files. Confirm no export format, storage key, task schema, or user-visible language drift.
8. [ ] Commit the documentation and any final test-only correction: `git add README.md tests package.json package-lock.json playwright.config.js scripts/app.js index.html styles/main.css && git commit -m "docs: document FocusBoard verification workflow"` (stage only files actually changed).

## Final Verification Checklist

- [ ] From a clean dependency install, `npm.cmd ci` succeeds using the committed lockfile.
- [ ] `npx.cmd playwright install chromium` installs the only configured browser; no other browser project is configured.
- [ ] `npm.cmd test` starts the local HTTP server automatically and passes all discovered tests.
- [ ] Browser tests assert HTTP origin and module/style response success; no `file://` browser context is used.
- [ ] Task/state, localStorage, JSON envelope/restore, and browser workflow cases listed above are covered.
- [ ] Keyboard focus follows the approved target/fallback rules; mouse actions receive no forced focus movement.
- [ ] Responsive checks pass at 1440×900, 768×1024, and 375×812; CSS remains unchanged if no actual issue is found.
- [ ] README instructions are beginner-friendly, English, and match the real scripts and server behavior.
- [ ] `node --check` for the three application modules and static server passes; `git diff --check` passes.
- [ ] `scripts/tasks.js` and `scripts/storage.js` remain untouched unless a scoped failing test proves a defect.
- [ ] No product feature, runtime dependency, general refactor, CI/CD, branch, or worktree was added as part of Phase 5 implementation.
