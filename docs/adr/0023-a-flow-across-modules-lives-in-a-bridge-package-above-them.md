---
status: accepted
date: 2026-11-13
decisions: D22, D143, D152, D189, D190, D231, D232, D241, D259, D266, D331
---

# A flow across modules lives in a bridge package above them

## Context

In the old app the domain areas imported each other in cycles. Work created recurring bookings
and read accounts, finance read time entries for payouts, and work and calendar wrote each
other's links. A time entry carried `paid` and `payout_id`, so the time code had to know about
payouts. No direction was binding: type-only imports, pure "planner" files, one small port and
shared transactions held the cycles together.

The flows themselves are real. Turning an appointment into a time entry reads the appointment,
the project and the rounding rule, may need a decision from the user or an agent, and writes
both sides in one transaction. Payouts need the same.

[ADR 0006](0006-module-boundaries-are-enforced-three-ways.md) forbids cycles between packages. It
does not say where such a flow goes when its two modules may not import each other. Without a
rule the shortest path comes back: a column or a call in the "larger" module.

No bridge exists yet. This ADR records the rules, so that the first one, with finance or
calendar, is built on them.

## Decision

- **A module imports another only when the domain requires it and the dependency runs one
  way.** The time module may build on `projects`; `projects` never learns of it. A module knows
  only the modules it builds on. The edge is an entry in `ALLOWED_IMPORTS` in
  `.dependency-cruiser.ts` next to the dependency in `package.json`, and the test over every
  `package.json` fails on a cycle, devDependencies included (ADR 0006). The importing module
  reads the other's data through its released read pieces
  ([ADR 0020](0020-modules-implement-their-ports-through-one-shared-frame.md)).
- **Every other flow lives in a bridge.** A bridge is its own package above the modules it
  joins, named by its purpose, for example `billing`. It owns the tables that link their rows
  (`payout_entries`, not `payout_id` on a time entry,
  [ADR 0003](0003-one-table-per-module-entity-in-local-sqlite.md)) and the named Operations of
  the flow. The modules do not know it: they do not import it and carry no column or call for it.
- **A bridge's Operation is one transaction over all sides.** Every entry of a module's Port
  also exists in a form that joins a running transaction: its lower function, defined through
  `defineStorageModule(…).entries(…)`, which receives the transaction and neither commits nor
  announces (ADR 0020). The bridge opens the transaction, calls the modules' lower functions and
  writes its own tables, so the flow commits or fails as a whole. It never writes a module's
  table itself. After the commit one Table Change (`tablesChanged`) names all the tables the
  transaction wrote, together. The transaction already records its own writes; the runner that
  opens one transaction over several modules and announces it is not built. The first bridge
  builds it.
- **A bridge reads through the modules.** It calls the lower functions of their Queries or joins
  their released read pieces. It never selects from a module's table; the lint rule
  `self-engine/no-foreign-row-map` rejects the import of a foreign row map.
- **A conflict is an answer, never a dialog.** An Operation opens no dialog. When it cannot go
  on without a decision, it returns a typed conflict with the options, and the caller calls it
  again with the choice. A View, a Command and a later assistant call it the same way. Today a
  conflict carries a reason the Contract declares (`CONFLICT` with `reason`, ADR 0020); a
  conflict that carries options comes with the first Operation that needs one.
- **A bridge guards a module's table with a Protection Rule from above.** A rule such as "a
  billed time entry cannot be deleted" belongs to the bridge, because the time module does not
  know billing. A Protection Rule guards one table and one kind of write, and the frame asks it
  at every write path, in the transaction of the Operation it guards
  ([ADR 0033](0033-protection-rules-guard-every-write-path-and-answer-with-typed-reasons.md)).
  A rule from above is registered where the Data Process is started, `startDataProcess({ rules
  })`, typed against the mounted modules' tables, and joins the modules' rules in one registry;
  the module below and its Contract learn nothing of it. A typed way for an ordinary package to
  state such a rule is not built yet (it comes with the first such rule, D341), and the desktop
  app registers none
  ([ADR 0022](0022-the-desktop-app-owns-the-module-list-and-the-data-protocol-what-crosses-modules.md)).

## Consequences

- A link between two modules is visible as a package: the bridge's entry in `ALLOWED_IMPORTS`
  lists both, and neither lists the bridge.
- A flow needs a package of its own even when it is small. That is the price for modules that
  can be understood and tested on their own.
- A module's read pieces and the entries a bridge calls are a surface others depend on:
  changing one is a change for its bridges.
- Not decided here: how a bridge's action appears in a module's Views. A rule's refusal is not
  a conflict reason: every Operation carries the Refusal, whose Reasons no Contract lists
  (ADR 0033).

## Considered Options

- **One fixed order of all modules, without bridges:** work and calendar need each other.
- **Events instead of calls:** no transaction spans both sides.
- **Link tables in the "larger" module:** brings the old cycles back.
- **Bridges calling the modules' Ports through their Contracts:** every call would own its own
  transaction.
- **Bridges reading module tables directly:** every column change breaks the reader, and the
  Space and deletion filters would exist twice.
