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
export const notesContract = {
  create: oc
    .input(z.object({ title: z.string().min(1), isPinned: z.boolean() }))
    .output(noteSchema),
  list: oc.input(z.object({})).output(z.array(noteSchema)),
};
