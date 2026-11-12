---
status: accepted
date: 2026-11-08
decisions: D11, D20, D21, D22, D33
---

# One table per module entity in local SQLite

## Context

The product is a focused app (projects, time, finance, calendar, habits), not a toolkit.
Users may add their own fields to existing types, but custom types like Notion databases and
third-party plugins are not goals. The data lives locally; sync comes later and its engine is
chosen then. A throwaway prototype (`prototypes/data-model/`) compared three models with
realistic data: tables per entity were as fast as a generic `objects` table with read tables.

## Decision

- **Each module entity gets its own table.** User-defined fields will go into a `custom` JSON
  column on that table when that feature is built; [ADR 0019](0019-row-maps-are-the-single-source-of-storage-types.md)
  postpones the column until then (D222).
- **Links between modules get their own tables** (for example `payout_entries`), never a flag
  or foreign key on the other module's table (no `paid` / `payout_id` on a time entry).
- Schema changes are ordinary migrations, and the database enforces references.
- Storage is **local SQLite through `better-sqlite3` 13**: one N-API binary for Node and
  Electron, so electron-builder runs with `npmRebuild: false` and tests run in Node.
- Every module talks to storage through its own port, never directly to a sync library.

## Consequences

- Migrations only move forward. Once a migration is on `main`, it never changes.
- Choosing a sync engine later means writing adapters for the ports, not reshaping the data.

## Considered Options

- **A generic `objects` table with generated columns or read tables.** Rejected: its main
  advantage, new fields without a migration, matters mostly for third-party plugins, which are
  no longer a goal.
- **`node:sqlite`.** Watched; not yet a replacement.
