import { oc } from "@orpc/contract";
import { reasonSchema } from "@self-engine/db/schema";
import { z } from "zod";

/**
 * The kinds of write on an existing row the Clearance answers for (D339). Insert is not one: a
 * rule that needs the new values, such as the reference check on insert and update, answers only
 * at the write. An update is asked without values, so only a rule that holds whatever is written
 * answers for it.
 */
export const clearanceWriteSchema = z.enum(["update", "delete", "restore", "archive", "unarchive"]);

export type ClearanceWrite = z.infer<typeof clearanceWriteSchema>;

/**
 * What one kind of write would meet for one row: nothing stands against it, the rules block it
 * with the Reasons a Refusal would carry, or the write would not find the row (unknown, of another
 * Space, or deleted where it needs a Live Row and live where it needs a deleted one).
 */
export const clearanceSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("free") }),
  z.object({ state: z.literal("blocked"), reasons: z.array(reasonSchema).min(1) }),
  z.object({ state: z.literal("notFound") }),
]);

export type Clearance = z.infer<typeof clearanceSchema>;

/** The answer for one asked row: one Clearance for each kind of write that was asked. */
export const rowClearanceSchema = z.object({
  row: z.string(),
  writes: z.partialRecord(clearanceWriteSchema, clearanceSchema),
});

export type RowClearance = z.infer<typeof rowClearanceSchema>;

/**
 * The Clearance (D339): a Query of the Data Process, the same for every module, which answers
 * beforehand which kinds of write are blocked for these rows of this table, and why. It asks the
 * same Protection Rules as the write paths, once per kind of write for every row, and writes
 * nothing. A table no mounted module has, a Local Table, or archive and unarchive of a table that
 * cannot be archived is invalid input (`BAD_REQUEST`).
 */
export const clearanceContract = oc
  .input(
    z.strictObject({
      table: z.string().min(1),
      rows: z.array(z.string()).min(1),
      writes: z.array(clearanceWriteSchema).min(1),
    }),
  )
  .output(z.array(rowClearanceSchema));
