/**
 * V1 — tables per entity (Self-Engine today): FK columns, a `custom` JSONB column per table for
 * user fields, the payout bridge as `time_entries.payout_id`.
 */
import type { DB } from "../shared/db.ts";
import { clean, SPACE, type Bridge, type Obj } from "../shared/data.ts";
import { validate, type ObjectType } from "../shared/modules.ts";
import { createOpLog, stmt, type QueryDef, type QueryName, type TimeEntryData, type Variant } from "../shared/variant.ts";
import type { Rounding } from "../shared/rounding.ts";

/** type -> table and field -> column mapping. Every new module field means editing this and the DDL. */
export const tables: Record<ObjectType, { table: string; cols: Record<string, string> }> = {
  project: {
    table: "projects",
    cols: { name: "name", hourlyRate: "hourly_rate", currency: "currency", roundingMode: "rounding_mode", roundingIntervalMin: "rounding_interval_min" },
  },
  time_entry: { table: "time_entries", cols: { projectId: "project_id", startAt: "start_at", endAt: "end_at", note: "note" } },
  payout: { table: "payouts", cols: { projectId: "project_id", amount: "amount", currency: "currency", paidAt: "paid_at" } },
  task: { table: "tasks", cols: { title: "title", status: "status", dueAt: "due_at", projectId: "project_id" } },
  appointment: { table: "appointments", cols: { title: "title", startAt: "start_at", endAt: "end_at", projectId: "project_id" } },
  cashflow: { table: "cashflows", cols: { amount: "amount", currency: "currency", at: "at", category: "category" } },
  habit_log: { table: "habit_logs", cols: { habitId: "habit_id", at: "at", value: "value" } },
  field_def: { table: "field_defs", cols: { key: "key", label: "label", valueType: "value_type", appliesTo: "applies_to" } },
};
/** Tables that hold user data (have a `custom` column). */
const dataTables = Object.values(tables).filter((t) => t.table !== "field_defs");

const common = `space_id text not null, custom blob, created_at integer not null, updated_at integer not null, deleted integer not null default 0`;

export const ddl = `
create table projects(id text primary key, name text not null, hourly_rate real not null, currency text not null,
  rounding_mode text not null, rounding_interval_min integer not null, ${common});
create table payouts(id text primary key, project_id text not null references projects(id), amount real not null,
  currency text not null, paid_at integer not null, ${common});
create table time_entries(id text primary key, project_id text not null references projects(id), start_at integer not null,
  end_at integer, note text, payout_id text references payouts(id), ${common});
create table tasks(id text primary key, title text not null, status text not null, due_at integer,
  project_id text references projects(id), ${common});
create table appointments(id text primary key, title text not null, start_at integer not null, end_at integer not null,
  project_id text references projects(id), ${common});
create table cashflows(id text primary key, amount real not null, currency text not null, at integer not null, category text not null, ${common});
create table habit_logs(id text primary key, habit_id text not null, at integer not null, value real not null, ${common});
create table field_defs(id text primary key, key text not null, label text not null, value_type text not null, applies_to text not null, ${common});

create index te_project_start on time_entries(project_id, start_at, end_at) where deleted = 0;
create index te_start on time_entries(start_at, end_at, project_id) where deleted = 0;
create index te_end on time_entries(end_at, start_at) where deleted = 0;
create index te_open on time_entries(project_id, start_at, end_at) where deleted = 0 and payout_id is null;
create index te_payout on time_entries(payout_id);
create index payouts_project on payouts(project_id) where deleted = 0;
create index tasks_project on tasks(project_id) where deleted = 0;
create index appointments_project on appointments(project_id) where deleted = 0;
`;

function insertSql(type: ObjectType): string {
  const { table, cols } = tables[type];
  const c = Object.values(cols);
  return `insert into ${table}(id, ${c.join(", ")}, space_id, custom, created_at, updated_at)
    values (?, ${c.map(() => "?").join(", ")}, ?, jsonb(?), ?, ?)`;
}

/** SQLite has no booleans or arrays: map them by hand (another V1 chore). */
export function toSql(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return v;
}

function insertOne(db: DB, o: Obj): void {
  validate(o.type, o.data);
  const { cols } = tables[o.type];
  const vals = Object.keys(cols).map((f) => toSql(o.data[f]));
  stmt(db, insertSql(o.type)).run(o.id, ...vals, SPACE, o.custom ? JSON.stringify(o.custom) : null, o.createdAt, o.createdAt);
}

const month = (col: string) => `strftime('%Y-%m', ${col} / 1000, 'unixepoch')`;
const linkedTables = ["time_entries", "payouts", "tasks", "appointments"];

const queries: Record<QueryName, QueryDef> = {
  hoursAll: {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from time_entries where deleted = 0 and end_at is not null group by 1, 2`,
    params: () => [],
  },
  hoursYear: {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from time_entries where deleted = 0 and end_at is not null and start_at >= ? and start_at < ? group by 1, 2`,
    params: (a) => [a.from, a.to],
  },
  overlap: {
    sql: `select id from time_entries where deleted = 0 and start_at < ? and end_at > ? and id <> ?`,
    params: (a) => [a.end, a.start, ""],
  },
  openHours: {
    sql: `select project_id, sum(end_at - start_at) / 3600000.0 as hours from time_entries
      where deleted = 0 and payout_id is null and end_at is not null group by project_id`,
    params: () => [],
  },
  backlinks: {
    sql: linkedTables.map((t) => `select '${t}' as source, id from ${t} where project_id = ? and deleted = 0`).join("\nunion all\n"),
    params: (a) => linkedTables.map(() => a.projectId),
  },
  customer: {
    sql: dataTables
      .map(({ table }) => `select '${table}' as source, id from ${table} where custom ->> '$.customer' = ? and deleted = 0`)
      .join("\nunion all\n"),
    params: (a) => dataTables.map(() => a.customer),
  },
};

export const v1: Variant = {
  name: "V1",
  createSchema(db) {
    db.exec(ddl);
    createOpLog(db);
  },
  insertObjects(db, objs) {
    for (const o of objs) insertOne(db, { ...o, data: clean(o.data) });
  },
  insertBridges(db, bridges: Bridge[]) {
    const s = stmt(db, "update time_entries set payout_id = ?, updated_at = ? where id = ?");
    for (const b of bridges) s.run(b.toId, b.createdAt, b.fromId);
  },
  queries,
  createCustomerIndex(db) {
    for (const { table } of dataTables) {
      db.exec(`create index ${table}_customer on ${table}(custom ->> '$.customer') where custom ->> '$.customer' is not null`);
    }
  },
  repo: {
    getTimeEntry(db, id) {
      const r = stmt(db, "select project_id, start_at, end_at, note from time_entries where id = ?").get(id) as
        | { project_id: string; start_at: number; end_at: number | null; note: string | null }
        | undefined;
      if (!r) throw new Error(`no time entry ${id}`);
      return { projectId: r.project_id, startAt: r.start_at, endAt: r.end_at, ...(r.note === null ? {} : { note: r.note }) };
    },
    getRounding(db, projectId): Rounding {
      const r = stmt(db, "select rounding_mode, rounding_interval_min from projects where id = ?").get(projectId) as {
        rounding_mode: Rounding["mode"];
        rounding_interval_min: number;
      };
      return { mode: r.rounding_mode, intervalMin: r.rounding_interval_min };
    },
    overlaps(db, startAt, endAt, excludeId) {
      return (stmt(db, queries.overlap.sql).all(endAt, startAt, excludeId) as { id: string }[]).map((r) => r.id);
    },
    insertTimeEntry(db, id, d: TimeEntryData) {
      stmt(db, insertSql("time_entry")).run(id, d.projectId, d.startAt, d.endAt, d.note ?? null, SPACE, null, Date.now(), Date.now());
    },
    updateTimeEntry(db, id, d: TimeEntryData) {
      stmt(db, "update time_entries set project_id = ?, start_at = ?, end_at = ?, note = ?, updated_at = ? where id = ?").run(
        d.projectId, d.startAt, d.endAt, d.note ?? null, Date.now(), id,
      );
    },
  },
  rebuild(db) {
    // V1 has no derived data besides indexes.
    const t0 = performance.now();
    db.exec("reindex time_entries");
    return { "reindex time_entries": performance.now() - t0 };
  },
};
