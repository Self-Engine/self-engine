# Agent Instructions

Self-Engine: a local-first productivity app for freelancers (projects, time, finance, calendar,
habits). Electron desktop first, local SQLite, React + Mantine, German and English. pnpm
monorepo on Vite+ (`vp`): apps in `apps/`, one package per module in `packages/`, repo tooling
in `scripts/`. Binding decisions live in [`docs/adr/`](docs/adr/); `docs/plan/` is the German
planning history.

## Task Completion

A task is done when `pnpm verify` prints `VERIFY: PASS` as its last line
([ADR 0008](docs/adr/0008-one-verify-gate-and-a-push-guard.md)). It formats, lints
(warnings fail), typechecks, checks the module boundaries, checks the ADRs, checks the theme CSS, builds the
workspace and runs the tests; failures show their tail, the full log is `.cache/verify.log`.
CI runs the same gate, except that its format stage only checks (`CI` set), so commit formatted files.
`pnpm check` is the quick loop while editing; `pnpm verify` is the gate. The flow: commit,
`pnpm verify`, commit any formatter output, push. A hook blocks `git push` and `gh pr create` (also behind
`sh -c`, shell keywords, or `git -C <other-checkout>`) unless the last pass covered exactly
HEAD of the checkout being pushed, so any edit after a pass needs another run (unchanged
stages replay from the cache). Run the app only when the user asks. If a change is visual
and was not checked in the app, say so in the final report and offer the check.

## Pull Requests

Every change goes through a PR; `main` stays releasable. Before creating, titling or merging a
PR, invoke the `pr-convention` skill: the title becomes the squash commit and the changelog
entry. Title and body in English. CI (`.github/workflows/`) runs two checks on every PR:
`quality` (`pnpm verify`) and `title` (`scripts/check-pr-title.ts`). Branch protection on
`main` requires a PR and both checks to pass; merge only when they are green.

## Commands and Tests

pnpm with Node 26; Bun, npm and yarn stay out of this repo. Tests are Vitest through `vp test`:
import test APIs from `vite-plus/test`; `pnpm test --reporter=agent` gives compact,
failure-focused output. Unit tests are deterministic: no network, no real clock, no files
outside a temp directory. Every script in `scripts/` has a test.

## Shell

The Bash tool runs zsh, which fails where bash would not:

- Quote globs or search with `rg` / `git ls-files`: an unmatched `*.yml` aborts the whole
  command with "no matches found".
- zsh arrays are 1-indexed; prefer `while read` loops over indexing.
- macOS has no `timeout` binary; use the tool's own timeout.
- One git command per call, and no `cd … &&`: run from the checkout root and pass paths.
- Check an exit code in the same call that ran the command (`cmd; echo "exit=$?"`).

Repeat these rules in the brief of every subagent that runs shell commands.

## Files and Secrets

Everything you create only for the current task (throwaway scripts, screenshots, dumps, notes)
goes into `.temp/` at the repo root. It is gitignored; never commit from it. Never print, log
or write down a secret value: refer to secrets by name only.

## Maintainability

Long-term maintainability is a core priority, and sweeping changes that improve it are welcome.
Before adding functionality, look for shared logic to extract; duplicated logic is a smell.
Change existing code instead of adding local workarounds. Build bottom-up: finish and test the
foundation before the feature that sits on it. Each module is its own package, reached only
through its `exports` ([ADR 0006](docs/adr/0006-module-boundaries-are-enforced-three-ways.md));
an import between two packages needs an entry in `ALLOWED_IMPORTS` in `.dependency-cruiser.ts`
next to the dependency in `package.json`.

## Agent skills

Repo skills live in `.agents/skills/<name>/`, each linked from `.claude/skills/<name>`.

- **Issue tracker:** GitHub issues in `GwydionBr/self-engine-next`, via `gh`. See
  [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
- **Triage labels:** the five canonical labels, unchanged, plus `layer:<n>`. See
  [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).
- **Domain docs:** single-context, one [`GLOSSARY.md`](GLOSSARY.md) plus `docs/adr/`. See
  [`docs/agents/domain.md`](docs/agents/domain.md).
