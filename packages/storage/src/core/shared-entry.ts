import type {
  Transaction,
  Insertable,
  Kysely,
  Selectable,
  SelectQueryBuilder,
  Updateable,
} from "kysely";
import type { StorageContext } from "./context.ts";
import type {
  Archivable,
  ArchivableTable,
  Convention,
  ConventionKey,
  RowId,
  SyncedTable,
} from "./convention.ts";
import type { ReadTransaction } from "./module.ts";
import { askRules } from "./rules.ts";
import { notFound } from "./not-found.ts";
import { isLocalTable } from "@self-engine/db";

type Fields<Row> = Omit<Row, ConventionKey> & { [Key in ConventionKey]?: never };
/** An edit's fields: a field left `undefined` is missing from the call and stays untouched. */
type EditFields<Row> = { [Key in keyof Fields<Row>]?: Fields<Row>[Key] | undefined };
const CONVENTION_COLUMNS: readonly string[] = [
  "id",
  "space_id",
  "created_at",
  "updated_at",
  "deleted_at",
  "archived_at",
];

function assertSynchronizedTable(table: string) {
  if (isLocalTable(table)) throw new Error(`Shared entry requires a synchronized table: ${table}`);
}

function writableFields(fields: object) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) => value !== undefined && !CONVENTION_COLUMNS.includes(key),
    ),
  );
}
/**
 * What a lower function reads through: a Query's read transaction or an Operation's write one.
 * Both name their row types, so `sharedEntry(tx, context)` infers them without written types.
 */
type ReadAccess<DB> = ReadTransaction<DB> | Transaction<DB>;

/**
 * One place for Space, live-row and archive scoping; compound queries remain ordinary Kysely.
 * `live` keeps archived rows: an archived row is a Live Row. `active` leaves them out too.
 */
export function sharedEntry<DB>(tx: ReadAccess<DB>, context: StorageContext) {
  // Kysely cannot infer convention columns from the conditional table-name constraint.
  // The public constraint guarantees them; this view is private to the shared implementation.
  // Only paths typed for an archivable table name `archived_at`.
  const db = tx as unknown as Kysely<Record<string, Convention & Archivable>>;
  function scoped(table: string) {
    assertSynchronizedTable(table);
    return db.selectFrom(String(table)).where(`${table}.space_id`, "=", context.spaceId);
  }
  function live<Table extends SyncedTable<DB>>(table: Table) {
    return scoped(table).where(`${table}.deleted_at`, "is", null) as unknown as SelectQueryBuilder<
      DB,
      Table,
      {}
    >;
  }
  function active<Table extends ArchivableTable<DB>>(table: Table) {
    return scoped(table)
      .where(`${table}.deleted_at`, "is", null)
      .where(`${table}.archived_at`, "is", null) as unknown as SelectQueryBuilder<DB, Table, {}>;
  }
  async function lookup<Table extends SyncedTable<DB>>(table: Table, id: RowId<DB, Table>) {
    const row = await scoped(table)
      .where(`${table}.deleted_at`, "is", null)
      .where(`${String(table)}.id`, "=", id)
      .selectAll()
      .executeTakeFirst();
    if (row === undefined) throw notFound();
    return row as Selectable<DB[Table]>;
  }
  return { live, active, lookup };
}

/** Standard single-row writes are available only on an operation's write transaction. */
export function sharedWrites<DB>(tx: Transaction<DB>, context: StorageContext) {
  const db = tx as unknown as Kysely<Record<string, Convention & Archivable>>;
  const reads = sharedEntry<DB>(tx, context);
  async function change<Table extends SyncedTable<DB>>(
    table: Table,
    id: RowId<DB, Table>,
    values: object,
    restoring: boolean,
  ) {
    assertSynchronizedTable(table);
    // RETURNING makes an absent row explicit without another query or an exception class.
    const result = await db
      .updateTable(String(table))
      .set({ ...values, updated_at: context.now })
      .where("space_id", "=", context.spaceId)
      .where("id", "=", id)
      .where("deleted_at", restoring ? "is not" : "is", null)
      .returningAll()
      .executeTakeFirst();
    if (result === undefined) throw notFound();
    return result as Selectable<DB[Table]>;
  }
  /**
   * Archive and unarchive change only a Live Row whose state differs; otherwise they answer with
   * the row as it is and write nothing, so a second call keeps the first Instant (D327).
   */
  async function setArchived<Table extends ArchivableTable<DB>>(
    table: Table,
    id: RowId<DB, Table>,
    archived: boolean,
  ) {
    assertSynchronizedTable(table);
    await askRules(tx, context, table, archived ? "archive" : "unarchive", [{ id }]);
    const result = await db
      .updateTable(String(table))
      .set({ archived_at: archived ? context.now : null, updated_at: context.now })
      .where("space_id", "=", context.spaceId)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .where("archived_at", archived ? "is" : "is not", null)
      .returningAll()
      .executeTakeFirst();
    return result === undefined
      ? reads.lookup(table, id)
      : (result as unknown as Selectable<DB[Table]>);
  }
  return {
    ...reads,
    async insert<Table extends SyncedTable<DB>>(
      table: Table,
      id: RowId<DB, Table>,
      fields: Fields<Insertable<DB[Table]>>,
    ) {
      // Also checks the reserved Local Table prefix at runtime for untyped callers.
      assertSynchronizedTable(table);
      const values = writableFields(fields);
      await askRules(tx, context, table, "insert", [{ id, values }]);
      const row = await db
        .insertInto(String(table))
        .values({
          ...values,
          id,
          space_id: context.spaceId,
          created_at: context.now,
          updated_at: context.now,
          deleted_at: null,
        })
        .returningAll()
        .executeTakeFirst();
      if (row === undefined) throw new Error("Insert returned no row");
      return row as Selectable<DB[Table]>;
    },
    /**
     * Writes the fields given and leaves a missing (`undefined`) one untouched (D329). With no
     * field left it reads instead: it answers with the live row, writes nothing, leaves
     * `updated_at` and announces no Table Change; an unknown id is still not found.
     */
    async update<Table extends SyncedTable<DB>>(
      table: Table,
      id: RowId<DB, Table>,
      fields: EditFields<Updateable<DB[Table]>>,
    ) {
      const values = writableFields(fields);
      if (Object.keys(values).length === 0) return reads.lookup(table, id);
      await askRules(tx, context, table, "update", [{ id, values }]);
      return change(table, id, values, false);
    },
    async softDelete<Table extends SyncedTable<DB>>(table: Table, id: RowId<DB, Table>) {
      await askRules(tx, context, table, "delete", [{ id }]);
      return change(table, id, { deleted_at: context.now }, false);
    },
    async restore<Table extends SyncedTable<DB>>(table: Table, id: RowId<DB, Table>) {
      await askRules(tx, context, table, "restore", [{ id }]);
      return change(table, id, { deleted_at: null }, true);
    },
    archive<Table extends ArchivableTable<DB>>(table: Table, id: RowId<DB, Table>) {
      return setArchived(table, id, true);
    },
    unarchive<Table extends ArchivableTable<DB>>(table: Table, id: RowId<DB, Table>) {
      return setArchived(table, id, false);
    },
  };
}
