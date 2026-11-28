---
status: accepted
date: 2026-11-28
decisions: D337, D338
---

# A Part Row is a Live Row only while its owner is one

## Context

Some rows exist only as part of another row: a Project Share of a Time Entry, a Rounding Rule of a
project. Whether such a row counts should stand in one place, its owner's row. The reference check
of ADR 0033 says "no Live Row refers to a deleted row" and knows one kind of reference, the one
that protects its target. With it alone, a share would block deleting its own entry, a share of a
deleted entry would keep its project from being deleted, and every module would delete and
restore its part rows with their owner itself. That copy drifts: a restore would have to tell the
rows deleted with the owner from those removed before, and after a sync a part row could live
under a deleted owner (#420, answer 4). D338 planned references that go with their target or stay
behind it; this is a third kind, built first.

## Decision

- **A table can name one of its references as "belongs to"**: in `defineStorageModule`,
  `belongsTo: { project_shares: "time_entry_id" }`. The declaration is typed against the row map:
  the table is a synced one of the module, the column one whose row type is a string, which may be
  empty. Its rows that name an owner are then **Part Rows** of the row they refer to, the
  **owner**. The owner can be a row of another module, which learns nothing of it.
- **A row of such a table that names no owner is an ordinary row, live by itself**: its other
  references protect and are counted under its own table, and every read and write treats it as
  any row. The app-wide Rounding Rule is such a row in the table of a project's Rounding Rules
  (#440), so one table and one lookup hold both.
- **A Part Row is a Live Row only while its owner is one.** The reference check keeps its sentence
  with that reading (`referenceCheck(references, parts)`):

  | Write                           | What changes                                                                                                                                                                                               |
  | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Delete an owner                 | Its Part Rows do not refuse it and stay untouched.                                                                                                                                                         |
  | Delete a row Part Rows refer to | A Part Row protects only while its owner is live; `referenced` counts the distinct owners, under the owner's table.                                                                                        |
  | Restore an owner                | Refused with `target_deleted` while one of its live Part Rows refers to a deleted, unknown or foreign row. The Reason stands at the owner, its field is the table of the Part Rows, one Reason per target. |
  | Insert a Part Row               | As any reference: a deleted owner is refused with `target_deleted` at the owner column.                                                                                                                    |

  The Clearance asks the same rules and so gives the same answers.

- **A write to a Part Row whose owner is deleted is not found**, like a write to a deleted row:
  update, delete, restore, archive and unarchive, and the Clearance answers `notFound`. The
  shared reads (`live`, `active`, `lookup`) leave such a row out. Each looks the owner up by
  primary key; a Query of a table of Part Rows names the owner's table among its reads.
- **A soft delete of a Part Row itself means it was removed from its owner.** It comes back only
  with its own restore; restoring the owner does not bring it back.
- **The start checks every declaration** against the references the schema holds
  (`partRows(modules, references)`): the column must be a reference of its table, a table does not
  belong to itself, and no row refers to a Part Row, so an owner is never a Part Row itself. A
  broken declaration fails the start of the Data Process. The frame carries the result to every
  call's context as `parts`, beside `rules`.
- **The contract kit knows Part Rows.** It builds the context as the Data Process does, with the
  reference check and the module's Part Rows (the seed runs without rules), checks the declaration
  the same way, requires a seed with a live Part Row of a live owner, and checks that every entry
  treats the Part Rows of a deleted owner as absent: it deletes their owners and compares the
  answer with and without those rows. A row that names no owner stays in both runs.

## Consequences

- A module with Part Rows writes no delete or restore for them, and the owner's module learns
  nothing of them: the Project Shares and the Rounding Rules declare one line each.
- **One named exception:** an Operation that takes back the creation of an owner removes its Part
  Rows while the owner still lives. The one such Operation is the undo of a Timer's stop
  (`undoStopTimer`): the entry's row is kept only so the next stop can reuse its id
  ([ADR 0039](0039-an-operation-over-two-tables-shares-one-id-and-its-undo-is-its-own-operation.md)),
  and its old shares would otherwise decide whether that stop can restore it. An entry taken back
  this way and restored by another route, such as the entry's own restore, comes back without
  projects.
- A read of a table of Part Rows costs one lookup of the owner by primary key per row. A read that
  joins the owner anyway pays it twice; that is the price of one place that decides.
- Not built: a Part Row of a Part Row, a reference to a Part Row, and the kinds "goes with" and
  "stays" of D338. Each would extend the start check and the rules here.
- An owner that refers to a row itself and through its Part Rows is counted once for each in
  `referenced`.

## Considered Options

- **Deleting and restoring the Part Rows with their owner** (each module itself): "is it live"
  would stand on every row, the rows drift apart after a sync, and a restore would have to tell
  the rows deleted with the owner from those removed before, by their time stamp.
- **A table of its own for the rows without an owner**, such as the app-wide Rounding Rule beside
  a project's rules: the same row in two tables, and a lookup that reads both.
- **Declaring the owner in SQL** (a comment or a naming rule): not typed against the row map, and
  the schema check could not tell an intended owner from a typo.
- **The owner reference as a Reason field on the part's column** for an owner's restore: the
  column is not a field of the owner; the table of the Part Rows names what the owner holds.
