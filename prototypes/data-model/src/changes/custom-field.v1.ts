/**
 * Change (b) in V1: the user adds a field "Invoice ref" to time entries and marks it filterable.
 * No developer code: the field definition is a row, values live in the existing `custom` column.
 * The app emits one expression index per table the field applies to.
 */
import type { DB } from "../shared/db.ts";
import { time } from "../shared/timing.ts";

// #region delta
// (nothing hand-written)
// #endregion

export const clientSteps = ["Zeile in field_defs (wird gesynct)", "Optional: Ausdrucks-Index je betroffener Tabelle (lokal, von der App erzeugt)"];
export const serverSteps = ["Keine (field_defs und custom-Spalten sind schon im Sync)", "Aber: jede Tabelle braucht die custom-Spalte, jede neue Tabelle auch"];

export function apply(db: DB): Record<string, number> {
  return {
    "insert field definition": time(() =>
      db.prepare(`insert into field_defs(id, key, label, value_type, applies_to, space_id, created_at, updated_at)
        values ('fd_invoice', 'invoiceRef', 'Invoice ref', 'text', '["time_entry"]', 'space_1', 0, 0)`).run(),
    ).ms,
    "optional: expression index (time_entries)": time(() =>
      db.exec(`create index time_entries_invoice_ref on time_entries(custom ->> '$.invoiceRef')
        where custom ->> '$.invoiceRef' is not null`),
    ).ms,
  };
}
