import type Database from "better-sqlite3";
import type { DB } from "./db.ts";
import type { Bridge, Obj } from "./data.ts";
import type { Rounding } from "./rounding.ts";
import { roundedEnd } from "./rounding.ts";
import { timeEntrySchema } from "./modules.ts";

export type QueryName = "hoursAll" | "hoursYear" | "overlap" | "openHours" | "backlinks" | "customer";
export const queryNames: QueryName[] = ["hoursAll", "hoursYear", "overlap", "openHours", "backlinks", "customer"];
export type QueryArgs = { from: number; to: number; start: number; end: number; projectId: string; customer: string };
export type QueryDef = { sql: string; params: (a: QueryArgs) => unknown[] };

export type TimeEntryData = { projectId: string; startAt: number; endAt: number | null; note?: string };

/** What the shared write path (timer stop) needs from a storage variant. */
export interface TimeRepo {
  getTimeEntry(db: DB, id: string): TimeEntryData;
  getRounding(db: DB, projectId: string): Rounding;
  overlaps(db: DB, startAt: number, endAt: number, excludeId: string): string[];
  insertTimeEntry(db: DB, id: string, data: TimeEntryData): void;
  updateTimeEntry(db: DB, id: string, data: TimeEntryData): void;
}

export interface Variant {
  name: "V1" | "V2" | "V3";
  createSchema(db: DB): void;
  /** Validates and inserts, maintaining every derived structure. Caller owns the transaction. */
  insertObjects(db: DB, objs: Obj[]): void;
  insertBridges(db: DB, bridges: Bridge[]): void;
  /** Optional faster path for an initial import (V3: truth first, then set-based projection rebuild). */
  bulkInsertObjects?(db: DB, objs: Obj[]): void;
  queries: Record<QueryName, QueryDef>;
  /** Variant-specific additional measurements (same result as a core query). */
  extraQueries?: Record<string, QueryDef>;
  /** Creates the index(es) a user would get by marking the `customer` user field as filterable. */
  createCustomerIndex(db: DB): void;
  repo: TimeRepo;
  /** Rebuilds every derived structure from the truth; returns timings per step in ms. */
  rebuild(db: DB): Record<string, number>;
}

// ---- operation log (identical in all variants) -----------------------------------------------

export function createOpLog(db: DB): void {
  db.exec(`create table op_log(
    seq integer primary key,
    op_id text not null,
    at integer not null,
    name text not null,
    object_id text,
    args text not null
  )`);
}

let opCounter = 0;
export function logOp(db: DB, name: string, objectId: string | null, args: unknown): void {
  stmt(db, "insert into op_log(op_id, at, name, object_id, args) values (?,?,?,?,?)").run(
    `op_${process.pid}_${opCounter++}`,
    Date.now(),
    name,
    objectId,
    JSON.stringify(args),
  );
}

// ---- prepared statement cache -----------------------------------------------------------------

type Stmt = Database.Statement<unknown[], unknown>;
const cache = new WeakMap<DB, Map<string, Stmt>>();
export function stmt(db: DB, sql: string): Stmt {
  let m = cache.get(db);
  if (!m) cache.set(db, (m = new Map()));
  let s = m.get(sql);
  if (!s) m.set(sql, (s = db.prepare<unknown[]>(sql)));
  return s;
}

// ---- shared write path ------------------------------------------------------------------------

export function startTimer(db: DB, v: Variant, id: string, projectId: string, startAt: number): void {
  db.transaction(() => {
    const data: TimeEntryData = { projectId, startAt, endAt: null };
    timeEntrySchema.parse(data);
    v.repo.insertTimeEntry(db, id, data);
    logOp(db, "timer.start", id, data);
  })();
}

/** Timer stop: load, round, validate, overlap check, write truth + projections, op-log. */
export function stopTimer(db: DB, v: Variant, id: string, now: number): { endAt: number; overlaps: number } {
  return db.transaction(() => {
    const entry = v.repo.getTimeEntry(db, id);
    if (entry.endAt !== null) throw new Error(`timer ${id} not running`);
    const rounding = v.repo.getRounding(db, entry.projectId);
    const endAt = roundedEnd(entry.startAt, now, rounding);
    const next: TimeEntryData = { ...entry, endAt };
    timeEntrySchema.parse(next);
    const overlaps = v.repo.overlaps(db, entry.startAt, endAt, id);
    v.repo.updateTimeEntry(db, id, next);
    logOp(db, "timer.stop", id, { endAt, rawEnd: now });
    return { endAt, overlaps: overlaps.length };
  })();
}
