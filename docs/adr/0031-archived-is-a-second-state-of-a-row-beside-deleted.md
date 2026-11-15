---
status: accepted
date: 2026-11-15
decisions: D306, D327
---

# Archived is a second state of a row beside deleted

## Context

At least four modules archive an entry: projects, recurring cashflows, bank accounts with
bookings and tasks with time entries (D306). An archived entry leaves the active lists and the
pickers but stays visible where old data points to it, and it can come back. If every module
set a column through an ordinary update and filtered by hand, the same filter would live in
every module, and no test would notice a picker that forgot it: an archived bank account in a
booking form would surprise no one until a user saw it. Two devices archiving the same entry
must not produce an error or a conflict about nothing.

## Decision

- `archived_at` is an optional convention column of a synchronized table: nullable `TEXT`
  holding an Instant, with no SQL `DEFAULT`. `checkConventions` checks its type and the missing
  default where a table has it; a Local Table is not held to it.
- `sharedEntry(tx, context).active(table)` selects the Live Rows of the Space that are not
  archived. `live(table)` and `lookup` keep archived rows: an archived row is a Live Row. A Live
  Row that is not archived is called active.
- `sharedWrites(tx, context)` gains `archive(table, id)` and `unarchive(table, id)`. Both, and
  `active`, are typed for tables whose row map has `archived_at`. `insert` and `update` never
  write the column, as with every other convention column.
- Three rules hold for every module:
  1. **Archived and deleted are independent.** `softDelete` and `restore` leave `archived_at`;
     deleting an archived row and restoring it brings it back archived.
  2. **Archiving locks nothing.** It is an ordinary change: it sets `updated_at` to the call's
     Instant, and the frame announces the table, so the Queries reading it are answered again.
     An archived row can be updated, deleted and restored like any other Live Row.
  3. **Archiving twice changes nothing.** Archiving an archived row keeps the first Instant,
     writes nothing, announces nothing and answers with the row; unarchiving a Live Row that is
     not archived does the same. An unknown or deleted id, and a row of another Space, is `NOT_FOUND`.
- In a Contract the Operations are `archive` and `unarchive`. `restore` stays the undo of a
  delete.
- A query entry declares `active: true` when its answer must hold no archived row. The contract
  kit archives every seeded Live Row of the module's archivable tables in a fresh database and
  fails the Query when one of their ids is still in its answer. Declaring it on a module without
  an archivable table fails too. The declaration sits on the entry, beside `reads`, so every run
  of the kit checks it and no test can drop it.
- The test module `cards` of `storage` proves the building block inside `storage`; `projects`
  is the first module that uses it.

## Consequences

A module makes a table archivable with one column in a forward migration and writes no archive
logic. Every Query that feeds an active list or a picker should be declared active; the kit
cannot find an undeclared one. The check compares ids, so an answer that leaks an archived row
only as a count goes unnoticed. The idempotent paths read the row once when nothing changes, so
a repeated call costs one primary-key read instead of a write. The extra condition in active
Queries costs nothing measurable: over 500 rows, 100 of them archived, a small-set Query
through the frame answered in about 170 to 245 µs with or without it, within the noise of the
measurement. The storage frame runs in the Data Process and adds nothing to the startup chunks.

## Considered Options

- Each module sets `archived_at` with an ordinary update and filters by hand: the same filter in
  every module, and no test notices a forgotten one.
- Archiving an archived row is an error or writes again: a second device would get an error, or
  a later sync would let a call that changed nothing win over a real change.
- Deleting clears the archive mark: undoing a delete would not restore what was there.
- Declaring active Queries in the kit call instead of on the entry: a module's test could
  forget the declaration where the module itself cannot.
