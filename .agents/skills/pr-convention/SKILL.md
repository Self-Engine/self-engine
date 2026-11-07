---
name: pr-convention
description: Conventional-Commit title rules for pull requests in this repo. Use when creating, titling, or merging a PR: the title becomes the squash commit on main and the changelog entry.
---

# Pull Request Convention

PRs are **squash-merged**, so the **PR title becomes the single commit on `main`**. A stable
release builds its changelog from the commits since the last stable (ADR 0007), so the title
is the changelog entry. CI rejects titles that break these rules.

## Rules

Write every PR title as a Conventional Commit: `type(scope): description`, lowercase, no
trailing period, in English.

| Type                                    | Changelog                                  |
| --------------------------------------- | ------------------------------------------ |
| `feat:`                                 | Features                                   |
| `fix:`                                  | Bug Fixes                                  |
| `perf:`                                 | Performance                                |
| `refactor:`, `revert:`                  | listed, but never the reason for a release |
| `docs:` `chore:` `test:` `build:` `ci:` | hidden                                     |

- Use `feat:`/`fix:`/`perf:` only for a change a user can notice. Tooling, CI and repo setup
  are `chore:`/`ci:`/`build:`, even when they are large.
- A breaking change gets `!` (`feat!: …`) or a `BREAKING CHANGE:` footer in the body.
- The type does not choose the version. Until `1.0.0`, a stable release proposes a patch bump;
  the owner raises the middle number by hand at milestones (ADR 0007).

## Write titles for users

The description is what a user reads in the changelog. Write the **outcome for the user**,
not the implementation.

- Describe **what changed for the user**, not how it was built. Leave out component and
  function names and words like "decompose", "stabilize", "hook", "selector".
- **One** user-visible idea per title. A PR doing several unrelated things should be split.
- Keep it short and concrete.

| Implementation-speak                                                  | User-facing                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `feat(desktop): decompose task detail view and share task form logic` | `feat(desktop): edit tasks in a side panel without leaving the board` |
| `fix(desktop): stabilize useTimelineSelection to prevent render loop` | `fix(desktop): stop the calendar flickering while selecting a range`  |
| `perf(time): memoize entry list selectors`                            | `perf(time): make long time-entry lists scroll smoothly`              |

## Scopes

All apps and packages ship under one product version. A scope makes changelog entries easy
to scan:

- App scopes: `desktop` (later `web`, `mobile`).
- Package scopes: the package directory name under `packages/` (for example `time`, `ui`).
- No scope for changes across the whole repo (`chore: scaffold the monorepo`).

## PR body

Write the body with the global `pr` skill's template when it is available, in English, and
end it with `Closes #<issue>` when the PR finishes an issue.
