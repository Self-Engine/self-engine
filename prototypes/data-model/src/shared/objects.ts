/**
 * The generic truth shared by V2 and V3: `objects` (module data + user data as JSONB),
 * `links` (bridge links owned by a bridge module, synced) and `links_index` (local, derived from
 * reference fields + live bridge links, used for backlinks).
 */
import type { DB } from "./db.ts";
import { clean, SPACE, type Bridge, type Obj } from "./data.ts";
import { objectTypes, refFields, validate, PAYOUT_COVERS, type ObjectType } from "./modules.ts";
import { stmt, type TimeEntryData } from "./variant.ts";
import type { Rounding } from "./rounding.ts";

export const coreDdl = `
create table objects(
  id text primary key,
  space_id text not null,
  type text not null,
  data blob not null,          -- JSONB, module fields
  custom blob,                 -- JSONB, user fields keyed by field-definition id
  schema_version integer not null default 1,
  created_at integer not null,
  updated_at integer not null,
  deleted integer not null default 0
);
create index objects_type on objects(type, deleted);

create table links(
  id text primary key,
  space_id text not null,
  kind text not null,
  from_id text not null,
  to_id text not null,
  owner_module text not null,
  created_at integer not null,
  deleted integer not null default 0
);
create index links_from on links(from_id, kind) where deleted = 0;
create index links_to on links(to_id, kind) where deleted = 0;

create table links_index(
  to_id text not null,
  kind text not null,
  from_id text not null,
  primary key (to_id, kind, from_id)
) without rowid;
create index links_index_from on links_index(from_id);
`;

/**
 * SQL that derives links_index rows from reference fields — the single definition used by the
 * write path (`one`: a single object, bound by id) and by the rebuild (`all`).
 */
const refLinksCache = new Map<string, string[]>();
export function deriveRefLinksSql(type: ObjectType, filter: "one" | "all"): string[] {
  const key = `${type}:${filter}`;
  let sql = refLinksCache.get(key);
  if (!sql) refLinksCache.set(key, (sql = buildRefLinksSql(type, filter)));
  return sql;
}
function buildRefLinksSql(type: ObjectType, filter: "one" | "all"): string[] {
  return refFields(type).map(
    ([field]) => `insert or ignore into links_index(to_id, kind, from_id)
      select data ->> '$.${field}', '${type}.${field}', id from objects
      where type = '${type}' and deleted = 0 and data ->> '$.${field}' is not null${filter === "one" ? " and id = ?" : ""}`,
  );
}
const deriveBridgeLinksSql = (filter: "one" | "all") => `insert or ignore into links_index(to_id, kind, from_id)
  select to_id, kind, from_id from links where deleted = 0${filter === "one" ? " and from_id = ?" : ""}`;

/** Re-derives the links_index rows of one object after a write. */
export function refreshLinks(db: DB, objectId: string, type: ObjectType): void {
  stmt(db, "delete from links_index where from_id = ?").run(objectId);
  for (const sql of deriveRefLinksSql(type, "one")) stmt(db, sql).run(objectId);
  stmt(db, deriveBridgeLinksSql("one")).run(objectId);
}

export function rebuildLinks(db: DB): void {
  db.exec("delete from links_index");
  for (const type of objectTypes) for (const sql of deriveRefLinksSql(type, "all")) db.exec(sql);
  db.exec(deriveBridgeLinksSql("all"));
}

const insertObjectSql = `insert into objects(id, space_id, type, data, custom, schema_version, created_at, updated_at)
  values (?, ?, ?, jsonb(?), jsonb(?), 1, ?, ?)`;

export function insertObject(db: DB, o: Obj): void {
  const data = clean(o.data);
  validate(o.type, data);
  stmt(db, insertObjectSql).run(o.id, SPACE, o.type, JSON.stringify(data), o.custom ? JSON.stringify(o.custom) : null, o.createdAt, o.createdAt);
}

export function insertBridge(db: DB, b: Bridge): void {
  stmt(db, "insert into links(id, space_id, kind, from_id, to_id, owner_module, created_at) values (?,?,?,?,?,?,?)").run(
    b.id, SPACE, b.kind, b.fromId, b.toId, b.ownerModule, b.createdAt,
  );
  stmt(db, "insert or ignore into links_index(to_id, kind, from_id) values (?,?,?)").run(b.toId, b.kind, b.fromId);
}

export function getData<T>(db: DB, id: string): T {
  const r = stmt(db, "select json(data) as d from objects where id = ? and deleted = 0").get(id) as { d: string } | undefined;
  if (!r) throw new Error(`no object ${id}`);
  return JSON.parse(r.d) as T;
}

export function updateData(db: DB, id: string, type: ObjectType, data: Record<string, unknown>): void {
  const d = clean(data);
  validate(type, d);
  stmt(db, "update objects set data = jsonb(?), updated_at = ? where id = ?").run(JSON.stringify(d), Date.now(), id);
}

/** Repo parts identical for V2 and V3 (both read module data from the truth). */
export const objectsRepoBase = {
  getTimeEntry(db: DB, id: string): TimeEntryData {
    return getData<TimeEntryData>(db, id);
  },
  getRounding(db: DB, projectId: string): Rounding {
    const p = getData<{ roundingMode: Rounding["mode"]; roundingIntervalMin: number }>(db, projectId);
    return { mode: p.roundingMode, intervalMin: p.roundingIntervalMin };
  },
};

export const customerQuery = {
  sql: `select type, id from objects where custom ->> '$.customer' = ? and deleted = 0`,
  params: (a: { customer: string }) => [a.customer],
};
export const backlinksQuery = {
  sql: `select kind, from_id from links_index where to_id = ?`,
  params: (a: { projectId: string }) => [a.projectId],
};
export function createCustomerIndex(db: DB): void {
  db.exec(`create index objects_customer on objects(custom ->> '$.customer') where custom ->> '$.customer' is not null`);
}

export { PAYOUT_COVERS };
