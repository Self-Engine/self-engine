import { oc } from "@orpc/contract";
import { idSchema, refusal } from "@self-engine/db/schema";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { noteIdSchema } from "../../notes-module/contracts/index.ts";
export const linkIdSchema = idSchema("NoteLink");
const link = z.object({
  id: linkIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  label: z.string(),
  noteId: noteIdSchema,
});
const byId = z.strictObject({ id: linkIdSchema });
export const linksContract = {
  create: oc
    .input(z.strictObject({ noteId: noteIdSchema, label: z.string().min(1) }))
    .output(link)
    .errors({ ...refusal }),
  update: oc
    .input(byId.extend({ noteId: noteIdSchema.optional(), label: z.string().min(1).optional() }))
    .output(link)
    .errors({ NOT_FOUND: {}, ...refusal }),
  delete: oc
    .input(byId)
    .output(link)
    .errors({ NOT_FOUND: {}, ...refusal }),
  restore: oc
    .input(byId)
    .output(link)
    .errors({ NOT_FOUND: {}, ...refusal }),
  list: oc.input(z.strictObject({ title: z.string().optional() })).output(
    z.array(
      link.extend({
        noteTitle: z.string().nullable(),
        noteDeletedAt: instantSchema.nullable(),
      }),
    ),
  ),
};
