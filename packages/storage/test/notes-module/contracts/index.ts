import { oc } from "@orpc/contract";
import { instantSchema } from "@self-engine/time";
import { idSchema } from "@self-engine/db/schema";
import { z } from "zod";
export const noteIdSchema = idSchema("Note");
export const noteSchema = z.object({
  id: noteIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  title: z.string(),
  isPinned: z.boolean(),
});
const conflict = { data: z.object({ reason: z.literal("title_taken") }) };
const byId = z.object({ id: noteIdSchema });
const storedNote = z.object({
  id: noteIdSchema,
  space_id: idSchema("Space"),
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
    .errors({ NOT_FOUND: {}, CONFLICT: conflict }),
  delete: oc.input(byId).output(storedNote).errors({ NOT_FOUND: {} }),
  restore: oc.input(byId).output(storedNote).errors({ NOT_FOUND: {}, CONFLICT: conflict }),
  create: oc
    .input(z.object({ title: z.string().min(1), isPinned: z.boolean() }))
    .output(noteSchema)
    .errors({ CONFLICT: conflict }),
  list: oc.input(z.object({})).output(z.array(noteSchema)),
};
