---
status: accepted
date: 2026-11-14
decisions: D144, D195, D286, D287, D288, D289
---

# Every row belongs to a Space the context supplies and the database knows

## Context

Every synchronized table has a `space_id` column, every call carries a _Space_ in its context,
and the contract kit proves that rows of another Space stay invisible
([ADR 0020](0020-modules-implement-their-ports-through-one-shared-frame.md)). Until #108 the
Space was one fixed id in the code, the same on every device, and no table held it.

That breaks in three places later. Two devices that meet on a server would claim the same id
for different people's data. A second device with offline data rewrites its `space_id` once,
in one transaction (D144); if that rewrite, or an import, misses one table, the rows of that
table stay under an id nothing knows, invisible and without an error. And SQLite cannot add a
foreign key to an existing table: adding it later means rebuilding every table on the user's
data. The first real module would have copied the missing key into every table of the app.

## Decision

1. **A _Space_ is a row of the table `spaces`.**

   ```sql
   CREATE TABLE spaces (
     id TEXT PRIMARY KEY NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted_at TEXT,
     space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED
       CHECK (space_id = id),
     kind TEXT NOT NULL
   ) STRICT;
   ```

   - A Space row is its own Space: the database holds `space_id = id`.
   - `kind` has one value, `personal`. The Row Map declares it; SQL does not check it, so a
     later kind such as an organization needs no rebuild of the table every other table refers
     to.
   - The table has no name and no owner column, and nothing sets `deleted_at`. It has no unique
     index and no trigger.

2. **`spaces` is a package below Storage, not a module.** It sits between `db` and `storage` and
   imports only `db` and `time`. Only `storage` and `data-process` import it, and the
   dependency-cruiser rule `renderer-stays-off-the-database` keeps it out of the page. It has no
   _Contract_ and no _Port_, and it is in no app's module list. It offers its migration, its Row
   Map, the id schema of a Space, `ensurePersonalSpace`, and a testing entry with fixed Space ids
   and `createSpaceRows`. `storage` re-exports `spaceIdSchema`, and a module takes it from there
   for its Row Map.

3. **The _Data Process_ makes sure of the _Personal Space_ at every start.** It runs the
   migration of `spaces` together with the mounted modules' migrations, in the one run of
   [ADR 0014](0014-migrations-belong-to-one-module-and-run-in-one-transaction.md). Only when the
   run left the database ready does it call `ensurePersonalSpace`, before it answers the first
   call:
   - In one transaction, it reads the Personal Spaces and inserts one when there is none. The
     new Space gets a UUIDv7 from the id source the app passes, and the _Instant_ of its clock.
   - When the transaction fails with `SQLITE_BUSY_SNAPSHOT`, because another Data Process
     inserted first, it runs once more and finds that Space.
   - Two Personal Spaces, or a deleted one, make it throw, and the start fails like any
     unexpected failure. Nothing is picked.

   In a failure state there is no Space and no _Frame_: every module entry is refused with
   `SERVICE_UNAVAILABLE`, as before
   ([ADR 0018](0018-the-database-runs-in-a-data-process-the-page-reaches-directly.md)).

4. **The context supplies the Space of every call.** Each module's Frame gets the Personal
   Space through `ContextSources.spaceId`, which is required and has no default. The app passes
   only a clock and an id source; it cannot assemble a Data Process without a Space. An
   _Operation_ takes no Space as input, and every read filters by the Space of its context.

5. **Every synchronized table refers to `spaces`, in one exact form:**

   ```sql
   space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED
   ```

   `checkConventions` requires it on every table that is not a _Local Table_:
   - `space_id` refers to `spaces(id)` by a key over that one column; a key over several
     columns that includes `space_id` does not count, and `REFERENCES spaces` without `(id)` is
     reported.
   - The key has no `ON UPDATE` and no `ON DELETE` action. An explicit `NO ACTION` passes,
     because SQLite records it like none.
   - The key is `DEFERRABLE INITIALLY DEFERRED`, which the rule for every foreign key checks.
   - There is no exception list. `spaces` passes itself, because its row refers to itself.

6. **The key to `spaces` is not a link between modules.** [ADR 0003](0003-one-table-per-module-entity-in-local-sqlite.md)
   and ADR 0014 put a foreign key to another module's table into a link table. `spaces` is no
   module and holds no data of the user: the key to it is part of the convention columns, the
   same on every table, like `space_id` itself. The rule for links between modules is
   unchanged.

7. **Tests get their Space rows from the helpers.** `createTestDatabase` in
   `@self-engine/storage/testing` runs the migration of `spaces` and creates the Space of the
   test context, `FIRST_SPACE_ID`. The contract kit creates the further Space rows it seeds into
   or moves rows to. A module's contract test writes no code for Spaces. A test inside `storage`
   that writes into another Space calls `createSpaceRows` from `@self-engine/spaces/testing`.

## Consequences

- A row cannot belong to a Space the database does not know. A rewrite of `space_id` or an
  import that misses a table fails as a whole when it commits, and nothing is written.
- A second device can keep the first device's id or rewrite its own, because the id is random
  and no two devices share it.
- The cost, measured on a file in a temp directory: making sure of the Personal Space takes
  about 0.3 ms on a first start (read and insert) and about 0.13 ms on a later start (read
  only), medians of 200 runs. The key costs about 0.06 µs per insert (100,000 inserts in one
  transaction, medians of 11 runs with and without it).
- The first start of an existing database after this change has `spaces/0001` pending, so it
  takes the Backup that comes before migrations
  ([ADR 0024](0024-a-backup-is-a-whole-copy-beside-the-database-and-the-next-start-puts-a-restore-in-place.md)).
- `placeholder-alpha` got a second migration that drops its table and creates it again with
  the key. Its rows in dev databases are lost; no stable release had shipped the table (D252).
- A migration cannot seed rows into a synchronized table: on a fresh database the Personal Space
  is created after the migrations, and a migration may read only its own module's tables, so
  it has no Space id to write.
- "One Personal Space" is a rule of the start, not of the database. Code that later writes a
  second Personal Space, such as an import or sync, is stopped only by the next start.
- A known limit of the start: when another connection has inserted the Personal Space but not
  yet committed, the insert of the second fails at once with plain `SQLITE_BUSY`, which the
  retry does not cover, so that start fails. It needs two Data Processes starting on one
  database at the same moment; the desktop app has no lock against a second instance.

## Considered Options

- **The Space in the context without a foreign key:** rejected (D286). It protects everyday
  calls, not a rewrite or an import.
- **The key as a written convention without a check:** rejected (D286). The first module would
  forget it.
- **`ON UPDATE CASCADE` on the key:** rejected (D286). An update would write silently into every
  table. A rewrite can name the tables itself, deferred keys allow it in one transaction, and the
  form stays neutral toward the sync engine (D89).
- **`spaces` as an ordinary module above `storage`:** rejected (D287). The contract kit in
  `storage` must write Space rows, which would be a cycle, and the Frame needs a Space for every
  call, so creating the first one cannot be a call through the Frame.
- **The table and making sure of the Space in `storage`:** rejected (D287). `storage` would own
  a real table.
- **A unique index on `kind`:** rejected (D288). An index on a synchronized table starts with
  `space_id`, and with `space_id` first it is useless, because every Space row carries its own
  id there.
- **A trigger that allows one Personal Space:** rejected (D288). The repo has no triggers, it
  would fire when a sync engine writes rows, and the kit needs several Spaces in one database.
- **A fixed id written by a migration:** rejected (D144). It collides on the server, and every
  device would have to rewrite it.
- **`space_id = id` held in code only, and `kind` only with organization Spaces:** rejected
  (D289). The first is the definition of a Space row; without the second the start would look
  for "the only row" instead of "the Personal Space".
