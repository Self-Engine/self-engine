# Agent Instructions

Self-Engine: a local-first productivity app for freelancers (projects, time, finance, calendar,
habits). Electron desktop first, local SQLite, React + Mantine, German and English. pnpm
monorepo on Vite+ (`vp`): apps in `apps/`, one package per module in `packages/`, repo tooling
in `scripts/`.

## Decisions

Read each decision by where it stands:

- An **ADR** in [`docs/adr/`](docs/adr/) states what the code does today. Build to it, and
  replace it with a new ADR when the code should work differently.
- An **issue** holds a decision that is not built yet: a spec, a grilling's answers, the
  resolution of a map's ticket. It is a **working assumption**: the best answer when it was
  written. It becomes an ADR when the code carries it.
- A **D-numbered decision** in [`docs/plan/`](docs/plan/00-decisions.md) (German) is the closed
  archive of the first weeks, also a working assumption. Look one up when a code comment or an
  ADR names its number and you need the reason. It gets no new entries.

Weigh every recorded decision you build on against what the code, the research and your own
knowledge say now. When you see a better way, tell the owner before you build on the decision:
name it, your alternative, and what the change costs. The owner decides. A decision gains no
weight from being written down or from being repeated in several places.

## Task Completion

A task is done when `pnpm verify` prints `VERIFY: PASS` as its last line
([ADR 0008](docs/adr/0008-one-verify-gate-and-a-push-guard.md)). It is the one gate: format,
lint, types, module boundaries, ADRs, migrations, theme CSS, translations, build, tests, the
stories in Chromium and a start of the built desktop app. A failure shows its tail; the full log
is `.cache/verify.log`.

`pnpm check` is the edit loop: it fixes format, then fails on lint warnings, type errors and
missing translations, in seconds. Run it until clean before every `pnpm verify`.

The flow: commit, `pnpm verify`, commit any formatter output and extracted catalogs, push. CI runs
the same gate but only checks format and catalogs, so both must be committed. A hook blocks
`git push` and `gh pr create` unless the last pass covered exactly HEAD of the checkout being
pushed, so any edit after a pass needs another run (unchanged stages replay from the cache).

Run the app only when the user asks or a
[large pull request](docs/agents/workflow.md#large-pull-requests) needs its app check, with its
window hidden; the [`verify-desktop`](.agents/skills/verify-desktop/SKILL.md) skill says how.
Repeat this in the brief of every subagent that checks the app. If a change is visual and was not
checked in the app, say so in the final report and offer that skill.

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
Before adding functionality, look for shared logic to extract. Change existing code instead of
adding local workarounds. Build bottom-up: finish and test the foundation before the feature that
sits on it. Each module is its own package, reached only through its `exports`;
`.dependency-cruiser.ts` lists which package may import which
([ADR 0006](docs/adr/0006-module-boundaries-are-enforced-three-ways.md)).

## Translated Text

Write text the user sees as the English sentence, through Lingui's macros: that text is the
message
([ADR 0011](docs/adr/0011-english-source-text-identifies-a-message-and-each-language-has-one-catalog.md)).
A short word with several meanings ("Open" as a verb and as a status) carries a context. Text in
data, outside components (a module's name, a command's label, a setting's title), is a `msg`
descriptor from `@lingui/core/macro`, translated where it is displayed. `pnpm verify` extracts the
text into `packages/i18n/src/locales/` and names every missing or broken translation: fill those
in and commit the catalogs.

## Agent skills

Repo skills live in `.agents/skills/<name>/`, each linked from `.claude/skills/<name>`.

- **Workflow:** read [`docs/agents/workflow.md`](docs/agents/workflow.md) before grilling, specifying, cutting or building an issue, and before opening or merging its pull request.
- **Issues:** GitHub issues in `Self-Engine/self-engine`, via `gh`.
  [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) has the commands,
  [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md) the labels.
- **Domain:** name things as [`GLOSSARY.md`](GLOSSARY.md) does, and read the ADRs and guides of
  the area you change: [`docs/agents/domain.md`](docs/agents/domain.md) lists them.
