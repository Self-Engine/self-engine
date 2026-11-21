import { pageSchema, pageInputSchema } from "../../../src/core/index.ts";
import { oc } from "@orpc/contract";
import { instantSchema } from "@self-engine/time";
import { defineReason, idSchema, inputErrors, refusal } from "@self-engine/db/schema";
import { spaceIdSchema } from "@self-engine/spaces";
import { z } from "zod";
export const noteIdSchema = idSchema("Note");
export const noteSchema = z.object({
  id: noteIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  title: z.string(),
  isPinned: z.boolean(),
});
/** The Reason of the module's Protection Rule: a pinned note is not deleted. */
export const pinnedNote = defineReason("pinned", z.object({ title: z.string() }));
/** The reason of the input error a note titled "Inbox" raises. */
export const TITLE_RESERVED = "title_reserved";
const conflict = { data: z.object({ reason: z.literal("title_taken") }) };
const byId = z.strictObject({ id: noteIdSchema });
const storedNote = z.object({
  id: noteIdSchema,
  space_id: spaceIdSchema,
  created_at: instantSchema,
  updated_at: instantSchema,
  deleted_at: instantSchema.nullable(),
  title: z.string(),
  is_pinned: z.union([z.literal(0), z.literal(1)]),
});
export const notesContract = {
  get: oc.input(byId).output(noteSchema).errors({ NOT_FOUND: {} }),
  update: oc
    .input(byId.extend({ title: z.string().min(1) }))
    .output(noteSchema)
    .errors({ NOT_FOUND: {}, CONFLICT: conflict, ...refusal }),
  delete: oc
    .input(byId)
    .output(storedNote)
    .errors({ NOT_FOUND: {}, ...refusal }),
  restore: oc
    .input(byId)
    .output(storedNote)
    .errors({ NOT_FOUND: {}, CONFLICT: conflict, ...refusal }),
  /** "Inbox" is reserved: the module raises an input error at the title after it wrote (D369). */
  create: oc
    .input(z.strictObject({ title: z.string().min(1), isPinned: z.boolean() }))
    .output(noteSchema)
    .errors({ CONFLICT: conflict, ...inputErrors(TITLE_RESERVED), ...refusal }),
  pages: oc.input(pageInputSchema).output(pageSchema(noteSchema)),
  window: oc
    .input(z.strictObject({ from: instantSchema, to: instantSchema }))
    .output(z.array(noteSchema)),
  list: oc.input(z.strictObject({})).output(z.array(noteSchema)),
};
