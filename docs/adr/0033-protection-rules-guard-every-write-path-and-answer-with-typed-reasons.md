---
status: accepted
date: 2026-11-17
decisions: D331, D332, D333, D334, D337, D338, D339, D371
---

# Protection Rules guard every write path and answer with typed Reasons

## Context

Some writes must not happen whatever their caller: a project that time entries refer to must
not be deleted, a billed time entry must not change. A check written inside one Operation holds
for that Operation only. A new Operation, a Bridge calling a module's lower functions, a page
that wants to show beforehand what is blocked, and a later check after a sync each need a copy.
The old app kept such guards per entity and fed them facts, so a lower entity had to know every
area above it. Soft deletion also means the database's own foreign keys never fire on a delete.

## Decision

- **A Protection Rule guards one table and one kind of write**: insert, update, delete,
  restore, archive or unarchive. It is stated with
  `protectionRule(rowMap, { table, write, reasons, answer })`; the row map types its table, its
  rows and its reads. `answer` receives a list of rows (with the written `values` for insert and
  update, and for a restore the values written with it, if any) and answers per row with
  Reasons. Its access only reads: by type, and a write throws at
  runtime.
- **Rules come from three sources into one registry** per Data Process
  (`protectionRules`), handed to every frame in its context:
  - a module lists rules for its own tables under `rules` in `defineStorageModule`;
  - the composition passes rules from above to `startDataProcess({ rules })`, typed against
    the mounted modules' synced tables; a rule for any other table, a Local Table included,
    does not compile with a typed module list and fails the start with an untyped one.
    A typed way for an ordinary package (a Bridge) to state such a rule, whose row map is
    private to the module below, is not built yet: the module below will release what a rule
    from above may see, built with the first rule that needs it (D341);
  - the frame brings the reference check.
- **The six write paths of `sharedWrites` ask the rules** for their table and kind of write
  before they write, in the same transaction. So a rule holds for every Operation, for a Bridge
  calling lower functions in its own transaction, and for each step of an Operation with
  several writes. Such a caller builds its context from `DataProcess.contextSources`, which
  carry the one registry, the reference check included. A write without a rule costs one
  lookup in memory. The lint rule
  `self-engine/no-write-outside-write-paths` rejects an insert, update or delete of a synced
  table outside those paths; its exceptions are named in the rule (today the insert of the
  Personal Space).
- **A refused write throws the Refusal**, `REFUSED` (HTTP status 422) with `{ reasons }`, at
  least one. It is the third expected failure beside `NOT_FOUND` and `CONFLICT`; the frame
  passes it through and nothing is written. A write that would not find its row answers
  `NOT_FOUND` whatever a rule answers, and an archive or unarchive that would change nothing
  answers with the row as it is, since it writes nothing a rule could guard: before it throws
  the Refusal, the frame looks the rows up once by primary key, so only a refused write pays
  that query. A Conflict stays a duplicate value its Contract
  lists. Every Operation's Contract spreads `refusal` from `@self-engine/db/schema` and lists
  no Reason's code, so a rule from above never changes a Contract. `ModuleEntries` accepts an
  Operation only with it and a Query only without it, and the contract kit checks it.
- **A Reason is defined once** with `defineReason(code, detailsSchema)` by the package that
  owns it, in a Contract entry. A Reason carries code, severity, table, row, an optional field
  and details. A rule answers only with the Reasons it names; the frame sets the table and the
  severity `blocking` and checks the details against the definition, so anything else is an
  unexpected error. `matchReason` gives a caller one Reason with typed details. The severity
  `warning` is reserved and produced by nothing yet.
- **The reference check**: no Live Row refers to a deleted row. After the migrations the Data
  Process reads every single-column foreign key between synced tables that points at an `id`
  (`referencesOf`); `space_id` and Local Tables are not references. It adds these rules:

  | Write                                   | Refused when                                       | Reason                                            |
  | --------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
  | Delete a row                            | a Live Row of any Space refers to it               | `referenced`: each referring table with its count |
  | Restore a row                           | a row it refers to is deleted                      | `target_deleted`: the column as field, the target |
  | Insert, or update of a reference column | the target is deleted, unknown or of another Space | `target_deleted`                                  |

  An archived row is a Live Row: it protects its target and is a valid target. Archive and
  unarchive are not guarded. Counts are taken only for a refused row. A row's reference to
  itself does not protect it. A restore may write fields in the same statement
  (`restore(table, id, fields?)`, D371); the rules judge the row as it stands afterwards: a
  reference written with it is checked like an insert's, every other one as stored. An update
  that writes no reference column runs no query. An unknown or foreign row being deleted or
  restored gets no answer, so it stays "not found".
  The conventions check requires an index that begins with every referring column, full or
  partial on `deleted_at IS NULL`, and no DEFAULT but NULL on it, since the check reads a
  reference from the written values.

- **The Clearance** is one Query of the protocol Contract, `clearance`, for every module:
  `{ table, rows, writes }` with writes out of update, delete, restore, archive and unarchive.
  It asks the same rules, through an access that cannot write, and answers per row and kind of
  write `free`, `blocked` with the Reasons, or `notFound`. An archive or unarchive that would
  change nothing is `free` without asking a rule, as at the write. An update is asked without
  values, so a rule that needs them answers only at the write. An unmounted table, a Local Table and
  archive on a table that cannot be archived are invalid input.

## Consequences

- Modules write no reference checks, and a lower module never learns what refers to it.
  `projects` is guarded with no code of its own.
- Each referring column costs an index; the checks were measured with 50,000 rows
  ([performance](../development/performance.md#protection-rules-274)).
- Not built: rules that warn, references whose rows go with their target or stay behind it
  (D338), a write path for many rows, the data check after a sync, and rules from the desktop
  app's composition. A device can still delete a row that another references offline (D306); a
  Read Piece keeps marking deleted targets.
- The renderer handles the Refusal and Clearance as described in ADR 0034.

## Considered Options

- **A check in each Operation** (D330 before): forgotten by the next Operation and every Bridge,
  and copied by the page.
- **Foreign key actions or triggers:** a soft delete is an update, so they never see it, and
  they cannot explain a refusal.
- **Guard functions per entity, fed with facts** (the old app): the lower entity has to know
  every area above it.
- **Reason codes listed in each Contract:** a rule from above would change a module's Contract.
