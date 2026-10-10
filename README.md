# FocusBoard

## About

FocusBoard is a small personal productivity dashboard for creating and tracking tasks in the browser.

## Features

- Create, edit, and delete tasks
- Set a task status, priority, and optional due date
- See overdue, due today, and upcoming labels for open tasks due within seven days
- Scan status and priority badges on task cards
- Search task titles and descriptions
- Filter tasks by status and priority
- Sort the visible tasks by default order, soonest due date, or priority
- See different messages when the board is empty or a search/filter has no matches
- View total, in progress, and completed task counts
- Save tasks in browser `localStorage`

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript (ES modules)
- Browser `localStorage`

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
`-- README.md
```

- `index.html` defines the page structure and task form.
- `styles/main.css` contains the visual styles and responsive layout.
- `scripts/app.js` connects the interface, events, rendering, and storage.
- `scripts/tasks.js` owns task state and task operations, search, and filtering.
- `scripts/storage.js` validates and reads or writes tasks in `localStorage`.
- `README.md` explains the project and how to run it.

## How to Run

Serve the project directory with a local static web server, then open its `index.html` address in a browser. For example, from this directory run:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`. Serving the files is needed because the app uses JavaScript modules.

## How to Use

Use the form to add a task, choose its status and priority, and set an optional due date. Select Edit to change a task or Delete to remove it after confirming. Search by title or description, filter by status and priority, and choose Default, Due date: Soonest, or Priority: High to Low in Sort by. Sorting only changes the displayed order. Select Clear search and filters to reset the search and filters.

Tasks are stored in this browser's local storage, so they remain after reloading the page in the same browser.

## Current Status

FocusBoard is an ongoing beginner-level project at the MVP stage. The core task management features, due-date labels, simple sorting, improved empty states, and responsive layout are implemented. Due-date filtering, progress percentage, and undo delete are not currently available.
