---
status: accepted
date: 2026-11-09
decisions: D91, D135, D136, D137, D138
---

# Migrations belong to one module and run in one transaction

## Context

The owner runs the Nightly every day with real data. A schema change that stops halfway leaves a
database that no version of the app has ever seen, and a fresh install or a test does not show
it. Modules also arrive at different times, so the order in which their migrations run differs
between a fresh install and a database that has grown over many versions.

## Decision

1. **Each module owns its numbered, hand-written SQL migrations.** A migration is named
   `<module>/<number>` and goes forward only. The caller composes the list, so
   `@self-engine/db` knows no module.
2. **A migration reads and writes only the tables of its own module.** A foreign key to another
   module's table is allowed, because SQLite accepts it before the parent table exists. This keeps
   a run's order from mattering: no migration depends on what another module's has done.
3. **All pending migrations of a run are one transaction.** SQLite can roll back DDL. Kysely
   assumes it cannot, so a small adapter reports the capability and Kysely wraps the whole run.
4. **A database that ran a migration this app does not know is refused.** The run ends with an
   error that names the migration, so an older build cannot work on a newer schema.

## Considered Options

- One transaction per migration file: a failure in the third of five would leave the database on
  a state between two versions of the app.
- One global sequence of numbers: two modules worked on in parallel would collide.
- Letting a migration touch another module's tables: its result would depend on the order of the
  modules, which differs between a fresh install and a grown database.

## Consequences

- Moving data between modules is not possible through a migration. A way for it is built when
  the case arises.
- A migration cannot change `foreign_keys`, because that pragma has no effect inside a
  transaction. A table rebuild relies on deferred foreign keys instead.
- The rule on a module's own tables is not enforced automatically. It is a written rule.
