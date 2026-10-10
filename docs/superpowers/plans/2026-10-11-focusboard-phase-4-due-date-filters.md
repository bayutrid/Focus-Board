# FocusBoard Phase 4: Task Organization and Filtering Upgrade

**Execution workflow:** Follow Superpowers `executing-plans` inline with strict `test-driven-development`: write a failing test, run it and verify the expected failure, implement the minimum change, run it green, then refactor while green. Do not use subagents. All production implementation and implementation commits belong in the isolated worktree described under Git Workflow.

## Goal

Make FocusBoard substantially easier to organize and navigate by adding composable due-date filtering, clear active-filter feedback, more informative empty states, and a coherent responsive organization toolbar without changing task data or Phase 1-3 behavior.

## Scope

- Add Due Date options: All, Overdue, Due today, Upcoming, No due date.
- Match date boundaries to existing `getDueDateStatus()`: overdue before local today; today on local today; upcoming tomorrow through day 7 inclusive.
- Exclude Done tasks from Overdue, Due today, Upcoming, and No due date. All remains unrestricted by due date.
- Compose due date with search, status, priority, and the existing display sorting.
- Show which filters are active and how many tasks match; identify active sorting when non-default.
- Clarify the zero-task, per-column-empty, and filtered-zero-result messages.
- Make Clear Filters reset search, status, priority, due date, and sort, without touching task data.
- Keep task-card due-date text and indicators consistent with the same existing date-status helper; make only a small directly related presentation adjustment if browser review shows it improves clarity.
- Improve toolbar layout at desktop and mobile, preserve visible keyboard focus and labels, and update the English README.
- Preserve localStorage data, task model, export envelope/version, restore validation, and restore safety exactly.

Out of scope: tags, categories, subtasks, calendar, drag and drop, analytics/charts, notifications, authentication, backend/database/cloud sync/accounts, PWA/service workers, dark mode, major redesign, framework/dependency/build-system/TypeScript migration, API integration, and AI features.

## Architecture Impact

- `scripts/tasks.js`: extend `getVisibleTasks(taskList, filters, today = new Date())` with due-date matching. Reuse `getDueDateStatus(task, today)` rather than implement a second date calculation. Preserve sorting as a copied display list and never mutate input tasks.
- `scripts/app.js`: read Due Date control state; render active organization/filter summary and result counts; improve no-match wording; reset all controls on Clear and reset due date after successful restore. Keep counters based on the complete task list. Continue applying `sortTasks()` after filtering.
- `index.html`: add the labeled Due Date select and a concise accessible summary/status location within the existing filter area.
- `styles/main.css`: make the five controls and Clear Filters a coherent responsive toolbar using existing visual styles; retain native keyboard behavior and visible focus.
- `README.md`: document filter meanings, combinations, sorting, and Clear Filters.
- `scripts/storage.js`, task fields, localStorage key/shape, and JSON export/restore format/version: no changes planned.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript ES6 modules
- localStorage
- Existing browser File APIs and HTTP local-server workflow
- Node built-in test/assert modules and existing headless browser approach if available
- No new dependencies, framework, backend, database, or build tool

## Interfaces and UI Decisions

- Due-date filter values: `all`, `overdue`, `today`, `upcoming`, `no-due-date`.
- `getVisibleTasks(taskList, filters, today = new Date())` reads optional `filters.dueDate`. Missing or unknown values default safely to `all`.
- Keep `getDueDateStatus(task, today)` as the date boundary authority. For `no-due-date`, match open tasks whose `dueDate` is null/empty; Done tasks are excluded.
- Add `#due-date-filter` with an associated visible label inside the existing search/filter form.
- Add a text summary such as `Showing 2 of 8 tasks. Active filters: Status: Todo; Due date: Upcoming. Sorted by Due date: Soonest.` The summary is hidden when no filter or non-default sort is active. It uses text, not color, to explain state.
- Keep the distinct global states: no tasks exist; one or more status columns are empty; filters return no tasks. The filtered-zero message should suggest changing or clearing filters.
- Clear Filters resets Search to empty, Status/Priority/Due Date to All, and Sort to Default. It must not call task mutation or persistence operations.
- Existing task cards already display a due-date value and use `getDueDateStatus()` for Overdue/Due today/Upcoming badges. Retain these meanings; test Done cards do not receive actionable badges. Only adjust wording/style if the RED browser check identifies a concrete clarity issue.
- The sort remains presentation-only: filter first, then call the existing `sortTasks()` on its copied result. Do not persist filter/sort state.

## Global Constraints

- All website UI and user-facing README content is English. Final implementation report is Bahasa Indonesia.
- Preserve Phase 1-3 functionality and current module responsibilities.
- Do not change task schema, localStorage key/format, export envelope/version, or restore schema/behavior.
- Do not add dependencies, frameworks, build tools, backend, database, or out-of-scope features.
- Done tasks do not match actionable due-date filters, including No due date.
- Filtering, sorting, and clearing filters must not modify task data or stored task order.
- Use local calendar dates and the existing seven-day Upcoming rule.
- Follow TDD for each behavior. Keep temporary tests/harnesses out of the final commit and remove them after verification.
- Do not modify production files in the main working tree.

## Review Focus

1. **Date boundary / timezone errors:** fixed local `today` tests for yesterday, today, tomorrow, day 7, and day 8; compare results to `getDueDateStatus()`. Covered in Task 1.
2. **Completed tasks in actionable views:** Done tasks with overdue, today, upcoming, and no due date must match none of those selections. Covered in Task 1 and Task 2 browser cases.
3. **No-date and out-of-window confusion:** a task with no due date matches No due date only when open; day 8 is not upcoming. Covered in Task 1.
4. **Filter composition / empty results:** combine search, status, priority, due date, and sort; verify a zero-result combination is described as no matching tasks, not no tasks. Covered in Task 2.
5. **Clear Filters data safety:** snapshot complete task objects and localStorage before/after clearing; only controls/view change. Covered in Task 2.
6. **State/order mutation:** compare input task array, object fields, and localStorage order before/after filtering and sorting. Covered in Task 1 and Task 2.
7. **Phase 3 portability regression:** export while filters are active and restore a valid/invalid/cancelled file; verify task schema, export version, recovery and replacement behavior unchanged. Covered in Task 3 regression sweep.
8. **Accessible status duplication:** ensure active-filter text and no-match messages remain understandable and do not make confusing repeated live announcements; inspect keyboard order, associated labels, and visible focus. Covered in Task 2/3.
9. **Viewport layout failure:** check desktop 1440px and mobile 375px for overflow, cramped controls, and readable cards/messages. Covered in Task 3.

## File Responsibility Map

### Planned production changes

- `scripts/tasks.js` - due-date matching in existing task filtering.
- `scripts/app.js` - current filter state, result/active summary, Clear Filters and successful-restore reset, due-date card consistency if required by test/review.
- `index.html` - due-date select and active organization summary/status markup.
- `styles/main.css` - filter toolbar layout, active summary and related responsive/focus styling.
- `README.md` - Phase 4 filter instructions and definitions.

### Do not change unless a failing test proves direct necessity

- `scripts/storage.js` - Phase 3 validation, persistence and portability are outside the changed behavior.
- Task fields, localStorage key/schema, JSON export format/version, restore schema.
- Other production files.

### Temporary verification artifacts

- A temporary Node test module and browser test/harness/profile may be created only in the isolated worktree or system temp directory. Remove them before committing. Add no permanent test framework or dependency.

## Tasks

### Task 1 - Implement deterministic due-date matching in the task filtering path

**Files:** `scripts/tasks.js`; temporary Node test file only (removed after use).

**Behavior:** Extend `getVisibleTasks(taskList, filters, today = new Date())`. All means unrestricted. Overdue, today, and upcoming reuse `getDueDateStatus()` and exclude Done tasks through that helper. No due date matches only open tasks with no due date. Missing/unknown filter values safely act as All. Other filters continue to compose. Source task list, objects, and order remain unchanged.

**Tests:** Use `node:test` and `node:assert` with a deterministic local date (e.g. October 10, 2026). Cover one task per date boundary (yesterday Oct 9, today Oct 10, tomorrow Oct 11, day 7 Oct 17, day 8 Oct 18), several tasks together, null/empty due date, Done at overdue/today/upcoming/no-date, all five values, fallback for missing/unknown value, composition with search/status/priority, and input array/object immutability. Exercise sort on the filtered copy and assert source order remains the same.

**RED:** Write these tests before editing `tasks.js`; run them. Confirm the failure is the expected due-date filter mismatch/unsupported behavior, not an import or test setup error. Record the exact failing assertion/output in the execution notes.

**GREEN:** Add the smallest predicate/branch to `getVisibleTasks()` and accept the optional fixed `today` argument for deterministic tests. Delegate actionable date categories to `getDueDateStatus()`.

**Verification:** Re-run targeted tests and confirm all pass; run existing task operations/filter/sort tests if present; run `node --check scripts/tasks.js`.

**Refactor:** Keep helpers small and avoid duplicated boundary math. Re-run tests after cleanup.

**Checkpoint:** No commit required at this intermediate task; include the tested production change in the final Phase 4 commit unless the work naturally warrants a reviewable commit.

### Task 2 - Integrate the organization toolbar, feedback, and reset behavior

**Files:** `index.html`, `scripts/app.js`; temporary browser test/harness only.

**Behavior:** Add labeled Due Date options (All default, Overdue, Due today, Upcoming, No due date). Include Due Date in `getCurrentFilters()`, `hasActiveFilters()`, and filter control change handling. Ensure `renderDashboard()` filters first and sorts only the displayed copy. Add visible text identifying active filters and non-default sort plus matching count. Keep counters based on all tasks. Distinguish no tasks at all, per-column empty states, and no matching current filters. Clear Filters resets search/status/priority/due-date/sort and rerenders without task mutation/storage writes. Successful restore resets the new control along with existing controls; cancelled or failed restore does not change the filter/task state.

**Tests:** Before editing production files, run a browser harness against the current application and verify it loads and existing controls work. RED checks should fail specifically because the due-date control and active summary do not exist. Test all option values, each result set, Done exclusion, search + due date, status + due date, priority + due date, all filters + sort, active summary text/count, sort-only summary, zero-result message, no-task message, column-empty message, Clear resets all controls, and task/localStorage snapshots unchanged after filtering/clearing. Test successful restore resets Due Date; cancellation/invalid restore retain existing tasks and current filter.

**GREEN:** Add the control and minimal `app.js` coordination/rendering logic. Reuse existing `getVisibleTasks()`, `sortTasks()`, save/restore flow, and counters.

**Verification:** Re-run browser checks and inspect the visible result and active summary. Confirm clear does not change title/description/status/priority/due date/createdAt/updatedAt/IDs or localStorage content.

**Refactor:** Avoid parallel filter state; the controls remain the source of truth. Keep messages concise and English. Re-run the checks after refactoring.

### Task 3 - Polish due-date presentation, responsive toolbar, and regression/documentation

**Files:** `styles/main.css`, `scripts/app.js` only if a card text change is demonstrated necessary, `README.md`; temporary browser regression harness only.

**Behavior:** Arrange Search, Status, Priority, Due Date, Sort, and Clear Filters as one readable organization area using existing visual language. Use available width at 1440px; stack/wrap at 375px with no horizontal overflow. Keep native controls, clear visible focus, and meaningful labels. Verify cards clearly expose due date and textual status badges; overdue/upcoming badges must use existing `getDueDateStatus()` and Done cards must not show actionable badges. Adjust `Due:` wording or badge layout only when the RED browser assertions/review identify a concrete readability issue. Update README Features and How to Use with filter meanings, seven-day inclusive Upcoming boundary, combined controls, and reset behavior.

**Tests:** Before CSS/card production changes, run browser assertions on the integrated markup at 1440px and 375px and capture the expected layout/readability issue. Test no horizontal overflow, control/card bounds, readable labels/messages, accessible names/label association, keyboard tab access, visible focus, and text badge meaning independent of color. Test card display for overdue/today/upcoming/no-date/Done-old-due tasks.

**GREEN:** Make minimal CSS/layout and directly justified card presentation changes. Add the English README description.

**Verification:** Repeat browser checks at both viewport sizes; test create/edit/delete/cancel-delete/status/priority/due-date flows; search/status/priority/sort; counters/localStorage; export/restore/invalid restore/cancel confirmation/corrupt-storage recovery. Confirm Phase 3 JSON envelope/version and canonical task fields are unchanged.

**Refactor:** Remove only temporary browser artifacts and any unnecessary CSS duplication. Re-run affected checks.

## Git Workflow

1. Baseline observed during planning: main checkout `master` at `ed3c784152f07c871475dea37b1cedd89dcdf93b`, tracking `origin/master`. The only current main-tree change is the untracked Phase 4 plan document. One older detached worktree is registered at `C:\Users\bayut\.codex\worktrees\2b7f\focusboard` on `f04a3c0`; do not modify or remove it.
2. Complete and review this plan before production changes. Preserve the plan in the project history as a docs-only plan checkpoint if needed so it is available in the implementation worktree; do not include production changes in that checkpoint.
3. Create a new branch/worktree named `feature/phase4-task-organization` at the approved current main HEAD, in a new path (for example `C:\Users\bayut\.codex\worktrees\focusboard-phase4`). Confirm it is a separate linked worktree and inspect its status before coding. Never reuse the old detached worktree.
4. Run baseline syntax/browser smoke checks in the new worktree before code changes. If baseline fails, record exact failures and separate pre-existing issues from Phase 4 behavior.
5. Perform all test-first implementation, review, and commits in the new worktree. Do not edit production files on `master`.
6. Commit the completed scope with `feat: improve task organization and due date filters`. Record the commit hash.
7. Cherry-pick that implementation commit onto `master` only after the worktree diff and tests have been reviewed. Do not rewrite existing commits, reset, force-push, or delete the user's older worktree.
8. Run fresh critical tests, syntax checks, and `git diff --check` on `master` after cherry-pick; report main and linked-worktree status explicitly. Do not push.

## Final Verification

- **Unit tests:** all due-date values and date boundaries; Done exclusions; missing dates; combined filters; sort/filter immutability.
- **UI/browser tests:** all options and combinations; active summary; clear behavior; empty-state distinctions; unchanged complete counters/task state.
- **Regression:** create/edit/delete/cancel delete; statuses; priority; due date; search; status/priority filters; sorting; counters; localStorage persistence; invalid stored-data handling.
- **Portability regression:** export/restore, invalid JSON/schema/task, duplicate/invalid IDs as existing coverage allows, cancelled confirmation, storage/corrupt-storage recovery; ensure export format/version and task schema do not change.
- **Browser desktop:** actual HTTP-served application at approximately 1440px; no console errors; filter/card/empty-state/portability flows work.
- **Browser mobile:** actual HTTP-served application at approximately 375px; no horizontal overflow; controls, cards, buttons, feedback remain readable and usable.
- **Accessibility:** visible associated labels, keyboard navigation, focus visibility, readable textual status independent of color, and understandable live-region behavior.
- **Syntax:** `node --check scripts/tasks.js` and `node --check scripts/app.js`.
- **Encoding:** scan changed HTML/CSS/JS/README/plan files for mojibake markers and confirm user-facing strings are English.
- **Git quality:** `git diff --check`; review full worktree and integrated diffs; ensure no temporary files, screenshots, debugging artifacts, dependencies, or unrelated changes remain.
- **Final state:** verify the implementation commit exists on master after cherry-pick, report worktree and main status; preserve all pre-existing user changes.

## Completion Criteria

- Due Date has the five required choices and exact local-date semantics; day 7 is Upcoming and day 8 is not.
- Done tasks match none of the actionable date filters; open no-date tasks match only No due date.
- Due Date composes with search, status, priority, and sort; sorting/filtering/clearing do not mutate task data or stored order.
- The toolbar clearly communicates active filters, result count, and non-default sorting; Clear Filters restores all defaults.
- Empty messaging distinguishes no tasks, empty status columns, and filtered no-match results.
- Task-card due-date information is clear and consistent with the existing date-status helper.
- Desktop 1440px/mobile 375px layouts and accessibility checks pass.
- Phase 1-3 regression and export/restore format remain intact.
- README accurately documents Phase 4 in English.
- TDD RED failures and GREEN passes are observed and recorded; syntax, mojibake scan, and `git diff --check` pass.
- No out-of-scope feature/dependency/schema change is introduced; production implementation is committed in an isolated worktree and cherry-picked to master, with fresh post-integration verification.
