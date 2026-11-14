# Add a module’s port

Use this guide when adding a module’s data access, changing a contract entry, or exposing
foreign data for a join. [ADR 0020](../adr/0020-modules-implement-their-ports-through-one-shared-frame.md)
records the architectural choice. Start from the test-only
[`notes` template](../../packages/storage/test/notes-module/); it is not registered in the app.
Its relative imports reach storage internals because it lives inside that package. A real
module imports `@self-engine/storage` and `@self-engine/storage/testing` through their exports,
as [`placeholder-alpha`](../../packages/placeholder-alpha/) does: the first module mounted in
the app (D252), with `src/contracts/`, `src/data/` and its kit test in `src/data/`.

## 1. Set up the entries and contract

A module’s port has two entries: `./contracts` for schemas and its one pure oRPC contract,
and `./data` for its row map, migrations, one function per contract entry, conflict reasons
and released read pieces. Keep UI code out of both. The app-wide contracts package composes
module contracts; a module never imports that package.

The package’s root entry carries what the module shows in the app shell, as defined by
[ADR 0013](../adr/0013-modules-declare-their-views-as-data-and-one-route-renders-them.md).
How its Views, drawers and Commands read and change the data through the port is the
renderer side, in [the second guide](port-hooks.md); start it once step 7 is done.

Copy the shape of [`notes/contracts/index.ts`](../../packages/storage/test/notes-module/contracts/index.ts):
use Zod schemas and `oc.input(...).output(...).errors(...)`. Share entity id schemas and
`Instant` through pure schema/value entries. Declare `NOT_FOUND` where applicable and
`CONFLICT` with the operation’s allowed reason codes. Write normal output schemas that
preserve values: no transforms, defaults, coercion or other conversions. Tests and development
check outputs; the packaged app skips that check. Inputs are always checked in the Data Process before a lower function runs.
Forms also check with the same input schema for field feedback (D317), but the Data Process
still checks every input and decides. Trimming belongs in the input schema, not a form-only
rule. Load the Contract with the lazy form, never at startup; see [the form guide](forms.md).

Every input is strict: write `z.strictObject(...)`, so an unknown key is an input error and
nothing is dropped silently ([ADR 0032](../adr/0032-every-edit-names-what-changes-and-its-inputs-come-from-one-field-list.md)).
The contract kit fails an object input that accepts an unknown field, for Queries and
Operations alike.

An entry that is created and edited lists its fields once and derives both inputs with
`entryFields` from `@self-engine/db/schema`, as the test module
[`memos`](../../packages/storage/test/memos-module/contracts/index.ts) does:

```ts
export const memoFields = entryFields(memoIdSchema, {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10_000).nullable(),
  color: z.enum(["red", "blue"]).nullable(),
});
// create: title required, body and color may be missing (then empty).
// edit: the id, every field optional; null clears body or color, never the title.
create: oc.input(memoFields.create.refine(bodyDiffers, bodyRule)).output(memoSchema),
edit: oc.input(memoFields.edit.refine(bodyDiffers, bodyRule)).output(memoSchema)
  .errors({ NOT_FOUND: {} }),
```

A field whose schema accepts `null` is optional; every other field is required. Declare a rule
across fields on the derived input with `.refine`, naming its field and its `params.reason`; on
an edit it checks the fields when both travel, so export the tied groups beside it for the form
([form guide](forms.md)). Name each field in the entry's answer as in the input: the kit
compares them by name. Archive, delete and restore stay named Operations, never fields.

Done when each planned query and operation has one contract entry, its input, full output
shape and expected error codes, without a second hand-written port interface.

## 2. Define owned rows and migrations

Follow [`notes/data/rows.ts`](../../packages/storage/test/notes-module/data/rows.ts): declare the
row map, derive query types with `TablesOf`, register numbered SQL files with `defineMigrations`,
and write a typed row-to-entity mapping. Map storage names and `0 | 1` explicitly; do not parse
rows on each read. Ordinary entities omit `spaceId` and `deletedAt`. An explicit deletion or
restore result may expose stored data, as notes does.

Apply [ADR 0019](../adr/0019-row-maps-are-the-single-source-of-storage-types.md) and
[the migration rules](../adr/0014-migrations-belong-to-one-module-and-run-in-one-transaction.md):

- A module lists only its own migrations, including when it consumes another module.
- A migration reads and writes only its own module’s tables. A foreign key may reference another
  module; it belongs in a link table. The key to `spaces` below is not such a link: `spaces` is
  no module, and every synchronized table has that key
  ([ADR 0028](../adr/0028-every-row-belongs-to-a-space-the-context-supplies-and-the-database-knows.md)).
- Add a new forward migration to change a schema. A merged migration is immutable.
- Synchronized tables carry the convention columns `id`, `created_at`, `updated_at`,
  `deleted_at` and `space_id`. Copy this line for `space_id` exactly:

  ```sql
  space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED
  ```

  No key over several columns in its place. In the row map, `space_id` uses `spaceIdSchema`
  from `@self-engine/storage`.

- Every foreign key is `DEFERRABLE INITIALLY DEFERRED`. On a synchronized table it has no
  `ON UPDATE` and no `ON DELETE` action: no `CASCADE`, `SET NULL`, `SET DEFAULT` or `RESTRICT`.
  Rows are only soft-deleted, and a parent is deleted only while no live row refers to it, so an
  action would delete or rewrite rows behind the Operations; `RESTRICT` would also fire before
  the deferred check. An explicit `NO ACTION` passes, because SQLite records it like none.

- Indexes on synchronized tables begin with `space_id`; unique indexes are partial on
  `WHERE deleted_at IS NULL`. The primary key’s automatic index is exempt, as are Local Tables.
- Local Tables have the `local_` prefix and their own shape. Shared synchronized-row helpers
  do not accept them. Nothing synchronized may depend on a Local Table.

- A synchronized table becomes archivable with one more convention column, `archived_at TEXT`:
  nullable, no `DEFAULT`, `instantSchema.nullable()` in the row map
  ([ADR 0031](../adr/0031-archived-is-a-second-state-of-a-row-beside-deleted.md)). The
  [`cards`](../../packages/storage/test/cards-module/data/migrations/0001.sql) test module shows
  it. Add it with a forward migration; every existing row starts active.

Done when `checkAgreement(migrations, rowMap)` and `checkConventions(database)` return no
violations, as in the notes tests. `checkConventions` names a synchronized table whose
`space_id` lacks the key to `spaces(id)` or refers elsewhere, and any foreign key that carries an
action or is not deferred, with its parent.

## 3. Implement the data entry

Follow [`notes/data/index.ts`](../../packages/storage/test/notes-module/data/index.ts).
A module is defined in two steps (D260):
`defineStorageModule({ name, contract, migrations, rowMap, conflicts? }).entries({ … })`.
The first step fixes the Contract and row map, so the entries take `tx` and `input` from them,
list builders included; write no types on a lower function’s parameters. `name` is the module’s
namespace in the app contract; page cursors carry it. `conflicts` is optional. Every contract key has an entry marked `kind: "query"` or `kind: "operation"`.
A query entry also declares `reads`: every table it takes rows from, including tables reached
through a released read piece, as `reads: ["note_links", "notes"]` in note-links. The types
require it. Operations declare nothing; the tables they wrote are announced after commit.
A Table Change naming one of a query's declared tables makes its answer outdated, so a
missing table leaves a list showing old data. The contract kit checks the declaration (step 6).
The Data Process collects every mounted Query's `reads` into one list and sends it to the page
with the opening event of each Table Change stream; the page learns from it which entries are
Queries and which tables they read, and never names a table itself.
Its lower function receives `(tx, context, input, entry, module)`: the checked input, stable
contract key and module name accompany the existing transaction. Queries receive read-only access; operations may write
only their owned tables. These functions neither open transactions nor announce tables.

Use `context.now`, the frozen `context.clock`, and `context.newId(entityIdSchema)` rather than
fetching time or ids yourself. Time is sampled once per call’s transaction. `context.spaceId`
is the Space of the call: the Personal Space that the Data Process made sure of at its start and
handed to every module's frame. No contract input carries a Space, and a module never creates
or looks up one.

For synchronized rows, use `sharedEntry(tx, context).live(table)` for a Space-filtered,
non-deleted select, and `.lookup(table, id)` for one live row or `NOT_FOUND`. Use
`sharedWrites(tx, context)` for `insert(table, id, fields)`, `update(table, id, fields)`,
`softDelete(table, id)` and `restore(table, id)`. These set convention columns; callers cannot supply those columns in fields, even through
non-literal objects, and runtime writes discard injected convention fields. Update and
soft delete require a live row; restore requires a deleted row. Unknown ids and ids in another
Space are not found; restoring a live row is also not found.

`update` writes only the fields that are not `undefined`, so an edit hands its input on field by
field, `{ title: input.title, body: input.body }`, and a missing field stays untouched. With no
field left it reads instead: it answers with the live row, writes nothing, leaves `updated_at`
and sends no Table Change. Mark such an entry `kind: "operation", edit: true`, as [`memos/data/index.ts`](../../packages/storage/test/memos-module/data/index.ts) does;
the kit then checks the edit pattern (step 6). The Operation does not compare with the stored
state: sending the value already stored writes and advances `updated_at` (ADR 0032).

On an archivable table, `sharedEntry(tx, context).active(table)` selects the Live Rows that are
not archived; `live(table)` and `lookup` keep archived rows, because an archived row is a Live
Row. `sharedWrites` adds `archive(table, id)` and `unarchive(table, id)`, typed for archivable
tables only; `insert` and `update` never set `archived_at`. Write no archive logic of your own,
as [`cards/data/index.ts`](../../packages/storage/test/cards-module/data/index.ts) shows:

- Archive sets `archived_at` and `updated_at` to `context.now`; unarchive empties `archived_at`
  and sets `updated_at`. Both are ordinary changes that announce the table, and they lock
  nothing: an archived row can still be updated, deleted and restored.
- Archiving an archived row, or unarchiving an active one, answers with the row as it is, keeps
  the first Instant and writes nothing, so nothing is announced.
- Both answer `NOT_FOUND` for an unknown or deleted id and for a row of another Space.
- Archived and deleted are independent: `softDelete` and `restore` leave `archived_at`, so a
  deleted archived row comes back archived.
- Name the Operations `archive` and `unarchive`; `restore` stays the undo of a delete.

For joins, aggregates and multi-row changes, use ordinary Kysely builders and explicitly
apply Space and live-row filters where required. Raw SQL and raw executors in storage are
rejected by `self-engine/no-raw-storage-sql`, including `sql` in read-only expressions.
Use `eb.fn` for SQL functions in storage queries; migration SQL remains separate.

Map each unique index name to its reason, as `notes_live_title: "title_taken"` does. Let the
index enforce uniqueness, rather than querying first. Unique indexes over the same columns
must map to the same reason: SQLite's diagnostic cannot distinguish their partial predicates. Restore into a reused title produces the
same conflict as create. Throw `ORPCError("CONFLICT", { data: { reason } })` for a business
conflict that no index expresses. Errors carry codes/reasons for the renderer to translate.

Done when every entry uses the supplied transaction and context, maps its result to its
contract shape, and has the appropriate query/operation marker and conflict mapping.

## 4. Choose each list’s kind

Use the three builders shown together in notes. Each one takes `tx` and `input` from the
entry’s place in the module, so a page list whose contract input extends `pageInputSchema` gets
its extra fields typed in `query`:

| Builder                                       | Use and contract                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `windowList(reads, run)`                      | A domain window, such as notes’ `from <= created_at < to`; returns the entire matching array. |
| `smallSetList(reads, run)`                    | A whole set expected to remain small; returns the entire array.                               |
| `pageList({ reads, row, query, order, map })` | A growing list. Use `pageInputSchema` and `pageSchema(entitySchema)` in the contract.         |

For pages, supply the selected row schema, scoped query, fixed order ending in `id`, and
row mapping. Every sort column must be non-null. One page list has one fixed order;
another order needs another contract entry. Notes orders by `created_at`, then `id`; its migration supplies the matching
Space-prefixed index. Size defaults to 100 and may be set from 1 to 500 in storage, never by
the renderer. The result has `rows`, `before` and `after`; pass a returned cursor unchanged
as `{ cursor }` to move in that direction. Total counts belong to #137.

A cursor carries the module’s name, the contract entry’s name, direction and sort values. It is unsigned and
survives a Data Process restart; it is an opaque navigation value for the renderer, not an
authorization token. Malformed cursors and cursors for another entry are rejected, also when another module’s entry has the same name. If a cursor page becomes empty,
for example after deletion, its opposite-direction cursor still leads back to existing rows.

Page cursor predicates and order clauses use unqualified selected column names. For a join
with overlapping sort-column names, wrap the joined query in a subquery exposing unambiguous
names. Sorting by a joined column sorts the full set on every page; no index can serve a
sort on the far side of a left join, and the kit rejects page plans that sort without an index.
Cursor queries must also use an index range beyond `space_id`, so later pages seek to their
anchor. Same-direction orders use a row-value comparison; mixed directions add a first-column
range bound to their lexicographic predicate. The kit checks both cursor directions even
when the seed leaves the list empty, and names ambiguous sort columns with the subquery remedy.

Window and small-set lists remain unbounded. With output checking enabled, a result of at
least 1,000 rows sends a warning naming the query through the frame’s injected `report`
callback; it still returns all rows.

Done when every list has an explicit kind, and page query plans use an index for sorting.

## 5. Release and consume foreign reads when needed

The owner exports a read piece from `./data` with only fixed released columns and a built-in
Space filter. [`noteTitles`](../../packages/storage/test/notes-module/data/read-piece.ts)
returns `id`, `title` and `deletedAt`, including deleted targets. The owner alone supplies its
row-map type. It takes the consumer's transaction as `ReadTransaction<DB> | Transaction<DB>`,
generic in `DB`, so a consumer passes its `tx` without a cast.
`self-engine/no-foreign-row-map` rejects consumers importing foreign row maps
or accessing an imported foreign module's `.rowMap`, including through `typeof`.
Only the desktop app's module list (`apps/desktop/src/data-modules.ts`) imports every module's
data entry.

Follow the second template,
[`note-links/data/index.ts`](../../packages/storage/test/note-links-module/data/index.ts):
keep only owned rows in the consuming row map and join `noteTitles(tx, context, "target")`
in one query. `tx` and `sharedEntry(tx, context)` are typed from the row map by the two-step
definition; write no transaction type and no type argument by hand. Its left join retains the link when the target is absent or in another Space;
a deleted target retains its title and explicit deletion mark.

An operation that stores a reference to another module's row looks the target up through the
read piece first and answers `NOT_FOUND` when it is missing, deleted or in another Space; the
contract entry declares that error. SQLite's foreign-key error does not name the constraint,
so the frame cannot translate it, and without the lookup a missing target would reach the
caller as an internal error. The lookup is one primary-key read per write. Filter and sort by released
columns in that same query. Declare allowed package dependencies in both `package.json` and
`ALLOWED_IMPORTS` in `.dependency-cruiser.ts`.

The bridge runner is not built yet; it comes with the first bridge. The intended runner
will call modules’ lower functions inside one transaction and announce all changed tables
together after commit. No exported runner currently makes that composition available.
A bridge will read through queries or released read pieces and never write foreign tables directly.

Done when foreign reads use only released pieces and the module writes only its own tables.

## 6. Run the contract kit and business tests

Copy the complete `notes passes the storage contract kit` test in
[`notes-module.test.ts`](../../packages/storage/src/testing/notes-module.test.ts).
The call is `checkContract(module, seed, examples, conflictExamples?, dependencies?)`; assert that it resolves
to `[]`. Import it from `@self-engine/storage/testing` in a real module.

Seed through lower functions using the supplied transaction/context, including a live row and
a deleted row. The kit runs the seed again for other Spaces, so every insert must succeed on a
repeated run; make an insert into a Local Table idempotent. Give every contract entry one valid example input, with ids matching the
seed’s deterministic ids. Supply conflict cases per operation, with an optional `prepare`
function, to trigger every declared reason. Notes covers create, update and restore conflicts.
Pass modules the consumer builds on as `dependencies`, for example `[notes]` for note-links.
Use `createTestContext` (built on `createTestSources`) and
`createTestDatabase(module, dependencies?)` for additional tests; the caller closes that database.

A module's tests write no code for Spaces. `createTestDatabase` runs the migration of `spaces`
and creates the Space of `createTestContext`, so rows the seed and the examples write refer to a
Space the database knows. The kit creates the further Space rows it seeds into or moves rows
to. Inside `storage`, a test that writes into another Space first calls `createSpaceRows` from
`@self-engine/spaces/testing`, which also holds the fixed Space ids.

The kit uses fresh in-memory SQLite with the migration of `spaces`, the dependencies’
migrations and the module’s own migrations. For every entry it replays the example with seeded live owned rows
soft-deleted, and with seeded owned rows moved to another Space. Each must behave as if those
rows were absent: the same output or the same not-found error. Rows explicitly seeded as
deleted remain available to restore examples in the deletion comparison. Operations also run
among additional foreign-Space and deleted owned rows; changing any of those rows fails.
For every query it compares the complete output with a database
containing only the first Space’s live owned rows against the output with foreign and deleted
owned rows present. This includes aggregates and by-id lookups; foreign read-piece targets
retain their deletion marks. Array queries without an explicit list kind fail the kit. It derives invalid inputs
itself from valid examples: wrong-typed values, omitted object keys and replaced top-level
values. A schema accepting every derived candidate fails. It checks rejection before the
handler runs with output checking both on and off, output shape and conversion-free schemas,
Space/deletion isolation, query read-only behavior, indexed page sorting and cursor seeks,
unique-index mappings and reachable conflict reasons. It repeats every operation's valid
example on the same database and rejects conflicts or reasons not declared by that entry.
Extra output fields have their own violation, separate from schema conversions and defaults. Business behavior still needs module-owned tests.

For an Operation marked `edit: true` the kit checks the edit pattern on a seeded database
([ADR 0032](../adr/0032-every-edit-names-what-changes-and-its-inputs-come-from-one-field-list.md)).
The input's required keys are the identity, its optional keys the fields, and the example sets
every field of a seeded entry. An edit with only the identity must answer, write nothing and
announce nothing, and an id no seed produced must be not found. After the example, the kit
sends each field alone, first as `null` where the input allows it, then as the example's value:
that field must be cleared or set, and every other field must keep its value. The kit test of
[`memos`](../../packages/storage/src/testing/edits.test.ts) shows a passing module and one for
each failure.

The kit records the tables each query’s SQL takes rows from (FROM, JOIN and subqueries,
including those a read piece builds) and reports `query reads an undeclared table: <table>`
for each one missing from `reads`. It sees only the SQL its example ran: a table a query
reads only under some inputs, such as a join added when a filter is set, is caught only by
an example that takes that path. Cover such a branch with a second `checkContract` call whose
example for that entry sets the filter, as the conditional-read test beside the note-links
kit test does. Declaring a table the example did not read is not a violation. Recording runs
only in the kit; the frame in the app never records reads.

The kit also fails when a table’s contents changed without being announced. A table is
announced when a successful write statement targeting it affected at least one row (an absent
affected-row count uses the returned-row count for a `RETURNING` statement; without `RETURNING`,
a missing count is conservatively treated as a write). Rewriting identical values can
therefore announce a table without changing its contents. A trigger writing another table
cannot ship unnoticed: the kit detects the unannounced changed table.

Declare every Query that must answer without archived rows as active, by adding
`active: true` to its entry, as `cards` does with `{ ...smallSetList(reads, run), active: true }`.
For each one the kit seeds a fresh database, archives every seeded Live Row of the module's own
archivable tables and fails with `active query returns an archived row` when one of those ids
is still in the answer, at any depth. A module without an archivable table that declares an
active Query fails with `active query has no archivable table`. Seed at least one live row, or
the check has nothing to archive.

Done when the kit returns no violations and business tests cover behavior beyond these rules.

## 7. Connect the module and verify

Add the data entry under its contract namespace to the desktop app's module list,
[`apps/desktop/src/data-modules.ts`](../../apps/desktop/src/data-modules.ts), which the app
passes to the Data Process; the core knows no module, so a module's tests may start it without a
cycle between packages. That single list builds both migrations and the router; the Data Process
adds the migration of `spaces` itself, so `spaces` is never on the list. Module namespaces
must not be `health`, `tablesChanged` or `backups`, which are reserved procedures of
`@self-engine/data-protocol`; compose the matching module contract in the app-wide contracts
package. The list is typed against the app contract, and a test compares the mounted namespace
keys. Add dependencies and allowed import directions together. Modules import storage, never
data-process, except from their tests (`TEST_ONLY_IMPORTS`). Storage itself imports neither Electron nor a
native driver; the driver and transport remain replaceable, independently of future sync.

The shared frame opens one transaction per call, runs the lower function, validates outputs
when enabled, and rolls back on failure. After commit it announces a nonempty table set once;
queries, failed operations and zero-row writes (including empty `RETURNING` results) announce nothing. A failing announcer is
reported as an unexpected error; the caller still receives the committed result. With output
checks on, a translated conflict reason not declared by the entry is also reported as an
unexpected error; the caller still receives the conflict. With checks off, translation is unchanged.
Unmapped unique violations
and other unexpected errors become `INTERNAL_SERVER_ERROR` and go to the same injected
`report` callback as large-result warnings. The Data Process passes that callback through.
Development builds report unexpected errors and large results to the console. Issue #37
will replace that reporter with the local error log; until then these reports write no file.
Special procedures such as streams or long imports with progress can remain hand-written.

For stories and component tests, Fixed Answers from the same contract stand in for the Data
Process ([renderer guide](port-hooks.md#6-show-each-state-in-a-story-with-fixed-answers)). Do not register notes or note-links as app modules; `placeholder-alpha` is the mounted example
(`placeholderAlpha` in both lists).

Done when the committed implementation passes `pnpm verify` with `VERIFY: PASS` as its final line.
Then build the hooks, Views and stories with [the renderer guide](port-hooks.md).
