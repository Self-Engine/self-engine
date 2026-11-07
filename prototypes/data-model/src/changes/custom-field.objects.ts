/**
 * Change (b) in V2 and V3: the user adds "Invoice ref" to time entries and marks it filterable.
 * The field definition is an object; one expression index on `objects` serves every type.
 */
import type { DB } from "../shared/db.ts";
import { insertObject } from "../shared/objects.ts";
import { time } from "../shared/timing.ts";

// #region delta
// (nothing hand-written)
// #endregion

export const clientSteps = ["Objekt vom Typ field_def (wird gesynct)", "Optional: ein Ausdrucks-Index auf objects (lokal, von der App erzeugt)"];
export const serverSteps = ["Keine (objects ist generisch gesynct)"];

export function apply(db: DB): Record<string, number> {
  return {
    "insert field definition": time(() =>
      insertObject(db, {
        id: "fd_invoice", type: "field_def", custom: null, createdAt: 0,
        data: { key: "invoiceRef", label: "Invoice ref", valueType: "text", appliesTo: ["time_entry"] },
      }),
    ).ms,
    "optional: expression index (objects)": time(() =>
      db.exec(`create index objects_invoice_ref on objects(custom ->> '$.invoiceRef')
        where custom ->> '$.invoiceRef' is not null`),
    ).ms,
  };
}
