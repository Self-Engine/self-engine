/**
 * Change (a) in V1: time entries get a module field `billable: boolean` (default true) that
 * reports filter on. Lines inside the `delta` region are what a developer writes by hand.
 */
import type { DB } from "../shared/db.ts";
import { time } from "../shared/timing.ts";

// #region delta
// shared/modules.ts — timeEntrySchema
export const zodLine = `billable: z.boolean().default(true),`;
// v1/v1.ts — tables.time_entry.cols
export const mappingLine = `billable: "billable",`;
// v1/v1.ts — repo: select list, row mapping (int -> boolean), update statement, bound value
export const repoEdits = [
  `select project_id, start_at, end_at, note, billable from time_entries where id = ?`,
  `billable: r.billable === 1,`,
  `update time_entries set project_id = ?, start_at = ?, end_at = ?, note = ?, billable = ?, updated_at = ? where id = ?`,
  `d.billable ? 1 : 0,`,
];
// client migration, versioned, runs once on every device
export const clientMigration = `alter table time_entries add column billable integer not null default 1`;
// server migration (Postgres) — must be deployed before any client writes the column
export const serverMigration = `alter table public.time_entries add column billable boolean not null default true`;
// sync rule (PowerSync bucket definition) — column list must include the new column
export const syncRule = `select id, project_id, start_at, end_at, note, payout_id, billable, custom from time_entries where owner_id = bucket.user_id`;
// #endregion

export const clientSteps = [
  "Versionierte Migration schreiben (ALTER TABLE) und mit der App ausliefern",
  "Repo-Mapping (select/insert/update, bool<->int) anpassen",
  "Generierte Row-Typen neu erzeugen",
];
export const serverSteps = [
  "Postgres-Migration (ALTER TABLE) deployen, bevor Clients schreiben",
  "Sync-Regeln (Spaltenliste) anpassen und deployen",
  "Alte Clients: unbekannte Spalte ignorieren / Mindestversion erzwingen",
];

export function apply(db: DB): Record<string, number> {
  return { "ALTER TABLE add column": time(() => db.exec(clientMigration)).ms };
}
