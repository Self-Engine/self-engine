import { oc } from "@orpc/contract";
import { idSchema } from "@self-engine/db/schema";
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
export const linksContract = {
  create: oc.input(z.object({ noteId: noteIdSchema, label: z.string().min(1) })).output(link),
  list: oc.input(z.object({ title: z.string().optional() })).output(
    z.array(
      link.extend({
        noteTitle: z.string().nullable(),
        noteDeletedAt: instantSchema.nullable(),
      }),
    ),
  ),
};
