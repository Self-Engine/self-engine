# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** The repo is a pnpm monorepo (`apps/*`, `packages/*`), but all packages share one domain vocabulary: one `GLOSSARY.md` and one `docs/adr/` at the repo root, no `GLOSSARY-MAP.md`.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the glossary of domain terms.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

`docs/plan/` holds the German planning history (decisions D1…D53). Once a decision has an ADR, the ADR is the source of truth; `docs/plan/` is history and is never edited to match new decisions.

If the glossary has no entry yet, **proceed silently**. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) adds terms when they actually get resolved, usually when the module that owns them is built.

## File structure

```
/
├── GLOSSARY.md                    ← domain glossary
├── docs/
│   ├── adr/                       ← 0001-<decision-as-a-sentence>.md, …
│   ├── agents/                    ← this file, issue-tracker.md, triage-labels.md
│   └── plan/                      ← planning history (German)
├── apps/                          ← desktop (and later web, mobile)
├── packages/                      ← one package per module, plus shared packages
└── scripts/                       ← repo tooling, each script with a test
```

## ADR format

- File name: `<4-digit number>-<kebab-case decision sentence>.md`; the title is the decision as a sentence.
- YAML front matter with `status:` (`proposed`, `accepted`, `deprecated` or `superseded`), `date:`, and `decisions:` when the ADR distils entries from `docs/plan/00-decisions.md`.
- Sections: Context, Decision, Consequences, Considered Options (when options were weighed).
- A new ADR takes the next number after the highest one in `docs/adr/`. Numbers are unique and never reused. `pnpm adrs:check` fails on a duplicate number, a bad name or a missing status; a duplicate usually means a parallel branch took the same number, so renumber yours after rebasing.
- To replace a decision, write a new ADR and set the old one to `status: superseded` with a `superseded-by:` line.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0003 (one table per module entity), but worth reopening because…_

Before adding or changing a module’s port, contract entry, or released read piece, follow
[the port guide](../development/port-pattern.md). Before reading or changing a module’s data
from its Views or Commands, follow [the renderer guide](../development/port-hooks.md).
