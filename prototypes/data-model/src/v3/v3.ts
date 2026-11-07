/**
 * V3 — same `objects` truth as V2, plus per-type read tables `rm_<type>` derived from the module
 * declarations, maintained in the same write transaction and fully rebuildable.
 * The payout bridge module contributes `rm_time_entry.payout_id` (derived from `links`).
 */
import type { DB } from "../shared/db.ts";
import { fieldExpr, modules, objectTypes, projectedFields, snake, type ObjectType, PAYOUT_COVERS } from "../shared/modules.ts";
import {
  backlinksQuery, coreDdl, createCustomerIndex, customerQuery, insertBridge, insertObject, objectsRepoBase, rebuildLinks,
  refreshLinks, updateData,
} from "../shared/objects.ts";
import { createOpLog, stmt, type QueryDef, type QueryName, type Variant } from "../shared/variant.ts";

const sqlType = { text: "text", int: "integer", real: "real" } as const;

/** Columns contributed to a read table by another (bridge) module. */
const contributed: Partial<Record<ObjectType, { col: string; sqlType: string; expr: string }[]>> = {
  time_entry: [
    {
      col: "payout_id",
      sqlType: "text",
      expr: `(select l.to_id from links l where l.from_id = o.id and l.kind = '${PAYOUT_COVERS}' and l.deleted = 0 limit 1)`,
    },
  ],
};
/** Extra indexes on read tables that are not plain field tuples. */
const extraIndexes: Partial<Record<ObjectType, string[]>> = {
  time_entry: [`create index rm_time_entry_open on rm_time_entry(project_id, start_at, end_at) where payout_id is null`],
};

export const projectedTypes = objectTypes.filter((t) => projectedFields(t).length > 0);

function columns(type: ObjectType) {
  return [
    ...projectedFields(type).map(([f, d]) => ({ col: snake(f), sqlType: sqlType[d.sql], expr: fieldExpr(f, d, "o.") })),
    ...(contributed[type] ?? []),
  ];
}

export function tableDdl(type: ObjectType): string {
  return `create table rm_${type}(id text primary key, ${columns(type).map((c) => `${c.col} ${c.sqlType}`).join(", ")})`;
}
export function indexDdl(type: ObjectType): string[] {
  return [
    ...modules[type].indexes.map(
      (tuple, i) => `create index rm_${type}_${i} on rm_${type}(${(tuple as readonly string[]).map((f) => snake(f)).join(", ")})`,
    ),
    ...(extraIndexes[type] ?? []),
  ];
}
/** The projection — one SELECT used by the write path (`one`) and by the rebuild (`all`). */
const projectSqlCache = new Map<string, string>();
export function projectSql(type: ObjectType, filter: "one" | "all"): string {
  const key = `${type}:${filter}`;
  let sql = projectSqlCache.get(key);
  if (!sql) projectSqlCache.set(key, (sql = buildProjectSql(type, filter)));
  return sql;
}
function buildProjectSql(type: ObjectType, filter: "one" | "all"): string {
  const cols = columns(type);
  return `insert into rm_${type}(id, ${cols.map((c) => c.col).join(", ")})
    select o.id, ${cols.map((c) => c.expr).join(", ")} from objects o
    where o.type = '${type}' and o.deleted = 0${filter === "one" ? " and o.id = ?" : ""}`;
}

export function refreshProjection(db: DB, id: string, type: ObjectType): void {
  if (!projectedTypes.includes(type)) return;
  stmt(db, `delete from rm_${type} where id = ?`).run(id);
  stmt(db, projectSql(type, "one")).run(id);
}

const month = (col: string) => `strftime('%Y-%m', ${col} / 1000, 'unixepoch')`;

const queries: Record<QueryName, QueryDef> = {
  hoursAll: {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from rm_time_entry where end_at is not null group by 1, 2`,
    params: () => [],
  },
  hoursYear: {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from rm_time_entry where end_at is not null and start_at >= ? and start_at < ? group by 1, 2`,
    params: (a) => [a.from, a.to],
  },
  overlap: {
    sql: `select id from rm_time_entry where start_at < ? and end_at > ? and id <> ?`,
    params: (a) => [a.end, a.start, ""],
  },
  openHours: {
    sql: `select project_id, sum(end_at - start_at) / 3600000.0 as hours from rm_time_entry
      where payout_id is null and end_at is not null group by project_id`,
    params: () => [],
  },
  backlinks: backlinksQuery,
  customer: customerQuery,
};

export function rebuildProjections(db: DB): void {
  for (const t of projectedTypes) {
    db.exec(`drop table if exists rm_${t}`);
    db.exec(tableDdl(t));
    db.exec(projectSql(t, "all"));
    for (const sql of indexDdl(t)) db.exec(sql);
  }
}

export const v3: Variant = {
  name: "V3",
  createSchema(db) {
    db.exec(coreDdl);
    for (const t of projectedTypes) {
      db.exec(tableDdl(t));
      for (const sql of indexDdl(t)) db.exec(sql);
    }
    createOpLog(db);
  },
  insertObjects(db, objs) {
    for (const o of objs) {
      insertObject(db, o);
      refreshLinks(db, o.id, o.type);
      refreshProjection(db, o.id, o.type);
    }
  },
  insertBridges(db, bridges) {
    for (const b of bridges) {
      insertBridge(db, b);
      refreshProjection(db, b.fromId, "time_entry"); // the bridge module's contributed column
    }
  },
  bulkInsertObjects(db, objs) {
    // Initial import / first sync: write the truth, then derive the read tables set-based.
    for (const o of objs) {
      insertObject(db, o);
      refreshLinks(db, o.id, o.type);
    }
    rebuildProjections(db);
  },
  queries,
  createCustomerIndex,
  repo: {
    ...objectsRepoBase,
    overlaps(db, startAt, endAt, excludeId) {
      return (stmt(db, queries.overlap.sql).all(endAt, startAt, excludeId) as { id: string }[]).map((r) => r.id);
    },
    insertTimeEntry(db, id, d) {
      insertObject(db, { id, type: "time_entry", data: d, custom: null, createdAt: Date.now() });
      refreshLinks(db, id, "time_entry");
      refreshProjection(db, id, "time_entry");
    },
    updateTimeEntry(db, id, d) {
      updateData(db, id, "time_entry", d);
      refreshLinks(db, id, "time_entry");
      refreshProjection(db, id, "time_entry");
    },
  },
  rebuild(db) {
    const t: Record<string, number> = {};
    let t0 = performance.now();
    db.transaction(() => rebuildLinks(db))();
    t["links_index"] = performance.now() - t0;
    t0 = performance.now();
    db.transaction(() => rebuildProjections(db))();
    t["rm_* tables (drop, fill, index)"] = performance.now() - t0;
    return t;
  },
};
