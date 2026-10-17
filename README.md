# FocusBoard

## About

FocusBoard is a beginner-friendly personal productivity dashboard for creating and tracking tasks in the browser.

## Features

- Create, edit, and delete tasks
- Change a task's status directly from its task card
- Undo the most recently deleted task during the current page session; Undo does not persist across reloads
- Set a task status, priority, and optional due date
- See overdue, due today, and upcoming labels for open tasks due within seven days
- Scan status and priority badges on task cards
- Search task titles and descriptions
- Filter tasks by status, priority, and due date
- See active filters, matching task count, and selected sort order
- Sort visible tasks by default order, soonest due date, or priority
- See helpful empty states for an empty board, empty columns, or filters with no matches
- View total, in progress, and completed task counts
- Save tasks in browser `localStorage`
- Export all tasks to a versioned JSON file
- Restore a valid FocusBoard JSON export after confirming replacement

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript ES modules
- Browser `localStorage`
- Playwright Test for development-only automated tests

## Project Structure

```text
focusboard/
|-- index.html
|-- styles/
|   `-- main.css
|-- scripts/
|   |-- app.js
|   |-- tasks.js
|   `-- storage.js
|-- tests/
|   |-- support/
|   |   |-- static-server.js
|   |   `-- task-fixtures.js
|   |-- app.spec.js
|   |-- focus.spec.js
|   |-- portability.spec.js
|   |-- responsive.spec.js
|   |-- smoke.spec.js
|   |-- storage.spec.js
|   `-- tasks.spec.js
|-- package.json
|-- package-lock.json
|-- playwright.config.js
`-- README.md
```

- `index.html` defines the page structure and task form.
- `styles/main.css` contains the visual styles and responsive layout.
- `scripts/app.js` connects the interface, events, rendering, and storage.
- `scripts/tasks.js` owns task state and task operations, search, and filtering.
- `scripts/storage.js` validates and reads or writes tasks in `localStorage`.
- `tests/` contains the Node-based task and storage tests and Chromium browser tests.
- `tests/support/static-server.js` serves the project over local HTTP without a server dependency.
- `playwright.config.js` configures the single Chromium test project and starts the local test server.
- `README.md` explains the project and how to run and verify it.

## Requirements

- Node.js 20 or later
- npm (included with Node.js)
- Chromium installed by Playwright for browser tests

## Run the app

From the project root, start the built-in Node HTTP server:

```sh
npm run serve
```

Open <http://127.0.0.1:4173> in a browser. The server accepts a port override if port 4173 is already in use:

```sh
npm run serve -- --port 4174
```

In Windows PowerShell, if the `npm` or `npx` script is blocked by the execution policy, use the command shims directly:

```powershell
npm.cmd run serve
```

To use a different port in PowerShell:

```powershell
npm.cmd run serve -- --port 4174
```

## Why HTTP instead of `file://`

FocusBoard loads JavaScript ES modules. Browsers restrict module loading from a `file://` URL, so opening `index.html` directly may prevent the application scripts from loading. Use the local HTTP server above for reliable browser behavior.

## Install test tooling

Install the exact development dependencies recorded in `package-lock.json`:

```sh
npm ci
```

In Windows PowerShell, use `npm.cmd ci` if required by the local execution policy.

## Install Chromium

Install the Chromium build that matches the installed Playwright version:

```sh
npx playwright install chromium
```

In Windows PowerShell, use `npx.cmd playwright install chromium` if required by the local execution policy. The test configuration uses Chromium only.

## Run automated tests

Run the complete suite from the project root:

```sh
npm test
```

To run one test file, pass its path after `--`:

```sh
npm test -- tests/tasks.spec.js
```

In Windows PowerShell, the equivalent commands are `npm.cmd test` and `npm.cmd test -- tests/tasks.spec.js`. Playwright starts the local HTTP server automatically for browser tests. Tests use `http://127.0.0.1:4173`; they do not load the app through `file://`.

## Test coverage

The automated suite checks:

- Task creation, editing, deletion, status, priority, due dates, filtering, sorting, ordering, and mutation safety
- Local storage missing, valid, invalid, corrupt, and unavailable states, plus persistence across reload
- JSON export format and canonical task fields
- Restore validation, duplicate IDs, extra fields, cancellation, failed persistence, and reload behavior
- Browser CRUD, combined filters and sorting, confirmation flows, keyboard focus, export, restore, and storage persistence
- HTTP module and stylesheet loading, server 404 handling, and path traversal rejection
- Responsive overflow, control and card bounds, message bounds, and board columns at the viewports listed below

## Responsive verification

Run the viewport checks with:

```sh
npm test -- tests/responsive.spec.js
```

The Chromium tests check these viewport sizes:

- Desktop: 1440 × 900, with three task columns
- Tablet: 768 × 1024, with three task columns
- Mobile: 375 × 812, with stacked task columns

At each size, the suite checks for horizontal overflow, verifies that forms, controls, task cards, and status messages stay within the viewport, and checks that card text stays within its task column. It also checks that the primary task and portability controls remain visible and usable.

## Quick manual smoke test

1. Start the app and add a task with a description, status, priority, and due date. Reload and confirm it remains.
2. Use the keyboard to reach a task's Edit button and activate it. Confirm focus moves to the Title field. Cancel and confirm focus returns to the same Edit button.
3. Edit a task, change its status, and save. Confirm the task moves to the correct column and focus remains in the form.
4. Use a task card's Status control with both keyboard and pointer. Confirm the task moves to the chosen column, the other task fields remain unchanged, the current filters and sort remain active, and the change persists after reload.
5. Use the keyboard to delete a task and confirm the dialog. Confirm focus moves to the next task, the previous task, or the column heading when the column becomes empty. Repeat and cancel the dialog.
6. Create two tasks with different status, priority, due-date, and description values. Delete one and confirm, then choose Undo. With Default sort selected, verify its fields and order return. Reload and confirm the task remains but the Undo action is no longer available.
7. Apply Search, Status, Priority, Due Date, and Sort controls, then activate Clear filters. Confirm focus remains on Clear filters and the task list is unchanged.
8. Export tasks and confirm a JSON file downloads. Restore that file, confirm replacement, and reload to verify persistence. Also try cancelling a restore and selecting an invalid JSON file.

## Troubleshooting

- **The app does not load when opening `index.html` directly:** start the HTTP server and use `http://127.0.0.1:4173` instead of `file://`.
- **The default port is already in use:** start the app with `npm run serve -- --port 4174` and open `http://127.0.0.1:4174`. Browser tests use port 4173; stop another server using that port before running them.
- **Playwright reports that Chromium is missing:** run `npx playwright install chromium` after installing dependencies.
- **PowerShell blocks `npm` or `npx`:** use `npm.cmd` or `npx.cmd` as shown in the setup instructions.
- **A browser test fails:** run the failing test file by itself with `npm test -- tests/<file>.spec.js` and read the failure output before changing code.

## Current Status

FocusBoard is an ongoing portfolio project at the MVP stage. Its core task management, filtering, sorting, local JSON export and restore, keyboard focus recovery, reproducible automated tests, responsive verification, last-delete Undo, and direct task-card status changes are implemented. Progress percentage is not currently available.
