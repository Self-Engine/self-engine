---
status: accepted
date: 2026-11-08
decisions: D44, D45
---

# One verify gate and a push guard

## Context

Agents write much of this code. A check they can skip, or one that differs between a human
and an agent, ends up skipped. `main` must stay releasable, and every change reaches it
through a PR.

## Decision

- **One gate, `pnpm verify`**, for humans, agents and CI: format, lint with warnings as
  errors, typecheck, the module boundaries ([ADR 0006](0006-module-boundaries-are-enforced-three-ways.md)),
  the ADR check, the guard against changed migrations, the theme CSS check, the translation check, the workspace build, then the tests and the story tests. The stages are
  `vp run` tasks, so an unchanged stage replays from the cache. The last line is `VERIFY: PASS`
  or `VERIFY: FAIL`.
- **A pass writes a stamp**: the git tree of the verified checkout.
- **A push guard** (a Claude Code `PreToolUse` hook) blocks `git push` and `gh pr create`
  unless the stamp of the repository the command publishes from (its `-C <dir>`, else the
  session's checkout) matches the tree of HEAD. The guard fails closed: its own errors, and a
  hook that cannot start, block too. The gate and the guard are Node 26 scripts with tests.

## Consequences

- The flow is commit → `pnpm verify` → commit any formatter output and extracted catalogs → push.
- Any edit after a pass, even a formatting fix, needs another `pnpm verify` before a push.
  The cache keeps that rerun short.
- Every stage must run through a tool whose file reads Vite Task can track. The typecheck
  stage is `vp check --no-fmt --no-lint`, not plain `tsc`: TypeScript 7's native binary is
  invisible to the tracking, so a cached `tsc` task replayed a pass after new type errors.
- The migrations stage (D142) reads git history, which the tracking cannot see, so it is the one
  stage that is uncached. It fails when the merge base with `origin/main` cannot be found, so CI
  checks out the full history.
- The build stage (`vp run --cache -r build`) makes the apps compile on every gate run, as ADR
  0001 requires: a pack entry pointing at a missing file passes typecheck and the tests and
  fails only there. It bundles and never starts Electron, so CI needs no Electron binary.
- The guard covers Claude Code only. CI runs the same gate for every PR and every push to
  `main` (`.github/workflows/ci.yml`); there the format and i18n stages check instead of
  rewriting (`verify:<stage>:check`), and CI does not depend on the stamp.
