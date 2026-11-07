/**
 * Change (a) in V3: `billable` on time entries. Same hand-written delta as V2; the framework sees
 * that the projection of `time_entry` changed and adds + backfills the read-table column.
 */
import type { DB } from "../shared/db.ts";
import { time } from "../shared/timing.ts";

// #region delta
// shared/modules.ts — timeEntrySchema
export const zodLine = `billable: z.boolean().default(true),`;
// shared/modules.ts — modules.time_entry.fields
export const declLine = `billable: { sql: "int", projected: true, default: 1 },`;
// #endregion

export const clientSteps = [
  "Keine handgeschriebene Migration: Projektionsversion ändert sich -> Framework ergänzt Spalte und füllt sie aus objects",
  "Alternativ: rm_time_entry komplett neu aufbauen (gleicher Code wie Rebuild)",
];
export const serverSteps = [
  "Keine Sync-Migration (JSONB). Neuen Modulcode (zod) im Server-Prüfdienst deployen",
  "Lese-Tabellen sind lokal -> Server hat keine (oder eigene) Projektionen",
];

export function apply(db: DB): Record<string, number> {
  return {
    "ALTER rm_time_entry + backfill from objects": time(() =>
      db.transaction(() => {
        db.exec(`alter table rm_time_entry add column billable integer`);
        db.exec(`update rm_time_entry set billable =
          (select coalesce(o.data ->> '$.billable', 1) from objects o where o.id = rm_time_entry.id)`);
      })(),
    ).ms,
  };
}
