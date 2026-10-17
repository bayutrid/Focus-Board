# Phase 8 CI and GitHub Pages Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automated CI for FocusBoard and deploy the existing static app to GitHub Pages after CI succeeds on `master`.

**Architecture:** Use one GitHub Actions workflow with a validation job for pushes to `master` and pull requests targeting `master`. A Pages deployment job depends on validation, runs only for pushes to `master`, packages only the current application files, and deploys them with the official GitHub Pages Actions.

**Tech Stack:** GitHub Actions, Node.js 24, npm, existing Playwright/Chromium suite, GitHub Pages Actions. No application runtime or package changes.

---

## Design Decisions

- Keep CI and deployment in `.github/workflows/ci.yml` so deployment's dependency on successful validation is explicit.
- Use Node.js 24, compatible with the repository's `node >=20` engine requirement and supported by current GitHub-hosted runners.
- Run `npm ci`, install the Playwright Chromium browser and system dependencies, then run the complete suite, the three existing source syntax checks, and a whitespace check over the event's changed commit range.
- On `master` pushes only, upload `index.html`, `styles/`, and `scripts/` directly. Do not publish test files, package files, or a generated build directory.
- Use least-privilege workflow permissions. Validation receives read-only repository contents. Deployment additionally receives the Pages, OIDC, and Actions read permissions required by the official deploy action.
- The repository path implies `https://bayutrid.github.io/Focus-Board/`; document it as the intended demo URL, subject to enabling Pages with GitHub Actions in repository settings.

## Execution Progress

- [x] Task 1 — Add validation workflow for push and pull request events (workflow structure reviewed; triggers, Node/npm/Playwright commands, least-privilege CI permissions, and changed-range whitespace check match the repository).
- [x] Task 2 — Add gated GitHub Pages deployment from `master` (official configure/upload/deploy action flow reviewed; deployment is push-to-master only, waits for validation, and uploads only static app files).
- [x] Task 3 — Document CI and Pages, verify the full change, and commit locally (README updated; 97/97 tests, syntax checks, YAML parse/format check, and staged/working diff whitespace checks passed; only the three planned files are staged; local commit follows this final checklist update).

## Execution Rules

- Work in the isolated `phase8-ci-github-pages` worktree based on current `master`; do not modify `master` directly.
- Keep changes limited to this plan, `.github/workflows/ci.yml`, and the focused README section.
- No application behavior, tests, dependencies, package files, schema, storage, or export changes.
- Run each task's verification before continuing. Run the full local test suite and syntax/whitespace checks before committing.
- Do not push or merge. Create one focused local commit only after all verification passes.

## Task 1: Add CI validation workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Steps:**

1. Create the workflow with `push.branches: [master]` and `pull_request.branches: [master]` triggers.
2. Add a `validate` job on `ubuntu-latest` with read-only `contents` permission.
3. Check out the repository, set up Node 24, run `npm ci`, install Chromium and its dependencies with Playwright, then run `npm test`.
4. Run `node --check scripts/app.js`, `node --check scripts/tasks.js`, and `node --check scripts/storage.js`.
5. Run `git diff --check` against the PR base-to-head or push before-to-head range; fetch sufficient history for that range.

**Verification:** Review triggers, commands, permissions, and YAML structure. Run the same complete tests and syntax checks locally in Task 3. No test files should change.

## Task 2: Gate official Pages deployment on CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**

1. Add a `deploy` job with `needs: validate` and an `if` condition restricted to `push` events on `refs/heads/master`.
2. Grant only the deployment permissions required by GitHub Pages: `contents: read`, `pages: write`, `id-token: write`, and `actions: read` for the official deploy action.
3. Set the `github-pages` environment and expose the deployment URL as its environment URL.
4. Use `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` at their documented compatible major versions.
5. Upload only `index.html`, `styles/`, and `scripts/` from the repository; do not build or modify the app.

**Verification:** Confirm deployment depends on `validate`, is skipped for pull requests and non-master events, uses the official Pages artifact flow, and packages all current app files without tests or dependencies.

## Task 3: Document CI/Pages and complete verification

**Files:**
- Modify: `README.md`

**Steps:**

1. Add a small CI/Deployment section naming the checks run and the `master`-only Pages deployment behavior.
2. Document the intended project demo URL and the GitHub repository setting required to enable the Actions publishing source. State that deployment becomes available after that setting is enabled; do not claim remote activation.
3. Run `npm.cmd test`; expected baseline is 97 passing tests.
4. Run the three `node --check` commands and `git diff --check`.
5. Inspect the workflow and final diff; ensure only this plan, the workflow, and README changed, with no app/test/dependency modifications.
6. Confirm the workflow's YAML and GitHub expressions manually; do not add a parser dependency.
7. Commit the verified changes with `ci: add GitHub Actions and Pages deployment`. Do not push.
8. Run `git status` and `git log --oneline -3`; confirm the worktree is clean and record the commit hash.

## GitHub-side setup not performed locally

In GitHub, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. Repository administrators may also need to allow GitHub Actions to create Pages deployments according to the repository's current Pages settings. This workflow cannot enable repository settings. No remote workflow run or deployed site will be claimed as verified by local execution.
