import { z } from "zod";
import { reasonSchema } from "./reason.ts";

/** The six kinds of write of the frame's write paths; a Protection Rule guards one (D331). */
export const writeKinds = [
  "insert",
  "update",
  "delete",
  "restore",
  "archive",
  "unarchive",
] as const;
export type WriteKind = (typeof writeKinds)[number];

/**
 * The kinds of write on an existing row the Clearance answers for (D339). Insert is not one: a
 * rule that needs the new values, such as the reference check on insert and update, answers only
 * at the write. An update is asked without values, so only a rule that holds whatever is written
 * answers for it.
 */
export const clearanceWriteSchema = z.enum(writeKinds).exclude(["insert"]);
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
