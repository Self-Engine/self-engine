import { oc } from "@orpc/contract";
import { idSchema } from "@self-engine/db/schema";
import { z } from "zod";

export const entryIdSchema = idSchema("PlaceholderAlphaEntry");
export const entrySchema = z.object({ id: entryIdSchema, name: z.string() });

const byId = z.object({ id: entryIdSchema });
const name = z.string().min(1);
/** Live names are unique; a restore into a name taken meanwhile meets the same conflict. */
const nameTaken = { data: z.object({ reason: z.literal("name_taken") }) };

/** The module's Port (D252): mounted as `placeholderAlpha` in the app contract. */
export const placeholderAlphaContract = {
  list: oc.input(z.object({})).output(z.array(entrySchema)),
  create: oc.input(z.object({ name })).output(entrySchema).errors({ CONFLICT: nameTaken }),
  rename: oc
    .input(byId.extend({ name }))
    .output(entrySchema)
    .errors({ NOT_FOUND: {}, CONFLICT: nameTaken }),
  delete: oc.input(byId).output(entrySchema).errors({ NOT_FOUND: {} }),
  restore: oc.input(byId).output(entrySchema).errors({ NOT_FOUND: {}, CONFLICT: nameTaken }),
};
