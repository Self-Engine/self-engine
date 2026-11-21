import { z } from "zod";

/** A UUIDv7 shared by an entity's contract and row, with its own id brand. */
export function idSchema<const Name extends string>(_name: Name) {
  return z.uuidv7().brand<`${Name}Id`>();
}

/** SQLite stores booleans as integers; the row-to-entity mapping converts them. */
export const sqliteBoolean = z.union([z.literal(0), z.literal(1)]);

export { entryFields, type FieldList } from "./entry-fields.ts";
export type {
  Archivable,
  ArchivableTable,
  Convention,
  ConventionKey,
  RowId,
  RowMap,
  SyncedTable,
  TablesOf,
} from "./tables.ts";
export {
  defineReason,
  findReason,
  type FrameReasons,
  matchReason,
  referenced,
  reasonSchema,
  refusal,
  severities,
  targetDeleted,
  type Reason,
  type ReasonDefinition,
  type ReasonOf,
  type Refusal,
  type Severity,
} from "./reason.ts";
export {
  type Clearance,
  clearanceSchema,
  type ClearanceWrite,
  clearanceWriteSchema,
  type RowClearance,
  rowClearanceSchema,
  type WriteKind,
  writeKinds,
} from "./clearance.ts";
export {
  type InputErrorReason,
  inputErrorData,
  inputErrors,
  type InputPath,
} from "./input-error.ts";
