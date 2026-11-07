/**
 * V2 — `objects` truth + VIRTUAL generated columns and partial indexes, both generated from the
 * module declarations. Reference fields feed `links_index`; the payout bridge is a row in `links`.
 */
import type { DB } from "../shared/db.ts";
import { fieldExpr, genCol, modules, objectTypes, projectedFields, snake, type ObjectType, PAYOUT_COVERS } from "../shared/modules.ts";
import {
  backlinksQuery, coreDdl, createCustomerIndex, customerQuery, insertBridge, insertObject, objectsRepoBase, rebuildLinks,
  refreshLinks, updateData,
} from "../shared/objects.ts";
import { createOpLog, stmt, type QueryDef, type QueryName, type Variant } from "../shared/variant.ts";

const sqlType = { text: "text", int: "integer", real: "real" } as const;

/** DDL derived from the module declarations: one VIRTUAL column per projected field, one partial index per declared tuple. */
export function moduleDdl(type: ObjectType): string[] {
  const out: string[] = [];
  for (const [field, d] of projectedFields(type)) {
    out.push(`alter table objects add column ${type}__${snake(field)} ${sqlType[d.sql]} as (${fieldExpr(field, d)}) virtual`);
  }
  modules[type].indexes.forEach((tuple, i) => {
    const cols = (tuple as readonly string[]).map((f) => `${type}__${snake(f)}`).join(", ");
    out.push(`create index ix_${type}_${i} on objects(${cols}) where type = '${type}' and deleted = 0`);
  });
  return out;
}

/** Optional per-type view over the generated columns: lets reports read `v_time_entry.start_at`. */
export function viewDdl(type: ObjectType): string | null {
  const f = projectedFields(type);
  if (f.length === 0) return null;
  const cols = f.map(([field]) => `${type}__${snake(field)} as ${snake(field)}`).join(", ");
  return `create view v_${type} as select id, ${cols}, custom, created_at, updated_at from objects
    where type = '${type}' and deleted = 0`;
}

export function moduleIndexNames(): string[] {
  return objectTypes.flatMap((t) => modules[t].indexes.map((_, i) => `ix_${t}_${i}`));
}

// Query builder: column names come from genCol(), so the expressions always match the indexes.
const te = {
  project: genCol("time_entry", "projectId"),
  start: genCol("time_entry", "startAt"),
  end: genCol("time_entry", "endAt"),
};
const TE = `type = 'time_entry' and deleted = 0`; // must match the partial-index predicate
const month = (col: string) => `strftime('%Y-%m', ${col} / 1000, 'unixepoch')`;

const queries: Record<QueryName, QueryDef> = {
  hoursAll: {
    sql: `select ${te.project} as project_id, ${month(te.start)} as month, sum(${te.end} - ${te.start}) / 3600000.0 as hours
      from objects where ${TE} and ${te.end} is not null group by 1, 2`,
    params: () => [],
  },
  hoursYear: {
    sql: `select ${te.project} as project_id, ${month(te.start)} as month, sum(${te.end} - ${te.start}) / 3600000.0 as hours
      from objects where ${TE} and ${te.end} is not null and ${te.start} >= ? and ${te.start} < ? group by 1, 2`,
    params: (a) => [a.from, a.to],
  },
  overlap: {
    sql: `select id from objects where ${TE} and ${te.start} < ? and ${te.end} > ? and id <> ?`,
    params: (a) => [a.end, a.start, ""],
  },
  openHours: {
    sql: `select ${te.project} as project_id, sum(${te.end} - ${te.start}) / 3600000.0 as hours from objects o
      where ${TE} and ${te.end} is not null
        and not exists (select 1 from links l where l.from_id = o.id and l.kind = '${PAYOUT_COVERS}' and l.deleted = 0)
      group by 1`,
    params: () => [],
  },
  backlinks: backlinksQuery,
  customer: customerQuery,
};

/** The same reports written against the per-type views — does the planner still use the partial indexes? */
const viewQueries: Record<string, QueryDef> = {
  "hoursAll (view)": {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from v_time_entry where end_at is not null group by 1, 2`,
    params: () => [],
  },
  "hoursYear (view)": {
    sql: `select project_id, ${month("start_at")} as month, sum(end_at - start_at) / 3600000.0 as hours
      from v_time_entry where end_at is not null and start_at >= ? and start_at < ? group by 1, 2`,
    params: (a) => [a.from, a.to],
  },
};

export const v2: Variant = {
  name: "V2",
  createSchema(db: DB) {
    db.exec(coreDdl);
    for (const t of objectTypes) {
      for (const sql of moduleDdl(t)) db.exec(sql);
      const view = viewDdl(t);
      if (view) db.exec(view);
    }
    createOpLog(db);
  },
  insertObjects(db, objs) {
    for (const o of objs) {
      insertObject(db, o);
      refreshLinks(db, o.id, o.type);
    }
  },
  insertBridges(db, bridges) {
    for (const b of bridges) insertBridge(db, b);
  },
  queries,
  extraQueries: viewQueries,
  createCustomerIndex,
  repo: {
    ...objectsRepoBase,
    overlaps(db, startAt, endAt, excludeId) {
      return (stmt(db, queries.overlap.sql).all(endAt, startAt, excludeId) as { id: string }[]).map((r) => r.id);
    },
    insertTimeEntry(db, id, d) {
      insertObject(db, { id, type: "time_entry", data: d, custom: null, createdAt: Date.now() });
      refreshLinks(db, id, "time_entry");
    },
    updateTimeEntry(db, id, d) {
      updateData(db, id, "time_entry", d);
      refreshLinks(db, id, "time_entry");
    },
  },
  rebuild(db) {
    const t: Record<string, number> = {};
    let t0 = performance.now();
    db.transaction(() => rebuildLinks(db))();
    t["links_index"] = performance.now() - t0;
    t0 = performance.now();
    for (const ix of moduleIndexNames()) db.exec(`reindex ${ix}`);
    t["reindex module indexes"] = performance.now() - t0;
    return t;
  },
};
