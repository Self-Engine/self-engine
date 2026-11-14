---
status: accepted
date: 2026-11-08
decisions: D10, D21, D36, D266, D284, D287
---

# Module boundaries are enforced three ways

## Context

Modules (projects, time, finance, calendar, habits) must stay separable from day one: it keeps
the code maintainable with agents writing much of it, and it is the only door we keep open
for plugins. A convention alone erodes; agents take the shortest import path.

## Decision

Each boundary is enforced by three independent mechanisms:

1. **One workspace package per module.** pnpm's strict isolation means a package can only
   import what it declares as a dependency.
2. **The `exports` field is the public interface.** Anything not exported is internal, and deep
   imports into another package fail to resolve.
3. **dependency-cruiser in CI** checks the allowed directions between packages and forbids
   cycles between files; a test of every `package.json` forbids cycles between packages,
   devDependencies included (D266).

`time` depends on no other package. Every package that stores, sends or shows a date takes its
values from `time`: today `db`, `storage`, `data-protocol`, `backup`, `settings-area` and
`placeholder-alpha`, and `data-process` in its tests. Only code in `apps/` loads the system
clock, `@self-engine/time/system-clock`; the dependency-cruiser rule `system-clock-only-in-apps`
rejects it anywhere else, and a package takes a _Clock_ as an argument (D284).

`spaces` is a package between `db` and `storage`, not a module, and imports only `db` and `time`.
Only `storage` and `data-process` import it; the rule `renderer-stays-off-the-database` keeps it
out of the page. Modules take the id schema of a _Space_ from `storage`
([ADR 0028](0028-every-row-belongs-to-a-space-the-context-supplies-and-the-database-knows.md),
D287).

A module's `./contracts` may import `time`, other declared module contracts and the pure
`@self-engine/db/schema` entry, but never database runtime code. The schema entry stays free of
Kysely, uuid and drivers. Dedicated purity rules protect these entries; package dependencies and
allowed directions still apply (D223–D225).

A formal module manifest follows only once the third module exists.

## Consequences

- Shared logic moves into a shared package instead of being imported sideways.
- Adding a dependency between two modules is a visible change in `package.json` and the
  dependency-cruiser rules, and reviewers can question it.
- An import a package needs only in its tests and stories is a devDependency and an entry in
  `TEST_ONLY_IMPORTS` in `.dependency-cruiser.ts`, never in `ALLOWED_IMPORTS`; its own code may
  not use it. A test that would close a cycle between packages belongs in a package above both.
