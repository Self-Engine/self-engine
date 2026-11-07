/**
 * Change (a) in V2: `billable` on time entries. The developer edits the zod schema and the module
 * declaration; the framework diffs declarations against `pragma table_xinfo(objects)` at startup
 * and emits the VIRTUAL column (no table rewrite).
 */
import type { DB } from "../shared/db.ts";
import { time } from "../shared/timing.ts";

// #region delta
// shared/modules.ts — timeEntrySchema
export const zodLine = `billable: z.boolean().default(true),`;
// shared/modules.ts — modules.time_entry.fields (default = value for objects written before the field existed)
export const declLine = `billable: { sql: "int", projected: true, default: 1 },`;
// #endregion

// emitted by the framework from the declaration (not hand-written)
export const generatedDdl = `alter table objects add column time_entry__billable integer
  as (coalesce(data ->> '$.billable', 1)) virtual`;
export const generatedIndex = `create index ix_time_entry_billable on objects(time_entry__billable, time_entry__project_id)
  where type = 'time_entry' and deleted = 0`;

export const clientSteps = [
  "Keine handgeschriebene Migration: Framework erzeugt VIRTUAL-Spalte (+ ggf. Index) aus der Deklaration",
  "schema_version des Typs erhöhen; Upcaster setzt Default beim Lesen (lazy) oder Hintergrundlauf (eager)",
];
export const serverSteps = [
  "Keine Sync-Migration (JSONB). Neuen Modulcode (zod) im Server-Prüfdienst deployen",
  "Optional: Ausdrucks-Index in Postgres, falls der Server danach filtert",
];

export function apply(db: DB): Record<string, number> {
  return {
    "ADD VIRTUAL column": time(() => db.exec(generatedDdl)).ms,
    "optional: partial index on it": time(() => db.exec(generatedIndex)).ms,
    "optional: eager upcast of all time entries": time(() =>
      db.exec(`update objects set data = jsonb_set(data, '$.billable', json('true')), schema_version = 2
        where type = 'time_entry' and schema_version < 2`),
    ).ms,
  };
}
