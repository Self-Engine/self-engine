import { oc } from "@orpc/contract";
import { idSchema } from "@self-engine/db/schema";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";

// Test-only module that proves the archive of the storage frame (D327); `notes` stays the
// template for everything else.
export const cardIdSchema = idSchema("Card");
export const cardSchema = z.object({
  id: cardIdSchema,
  updatedAt: instantSchema,
  archivedAt: instantSchema.nullable(),
  title: z.string(),
});
const byId = z.object({ id: cardIdSchema }).strict();
export const cardsContract = {
  get: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
  create: oc.input(z.object({ title: z.string().min(1) }).strict()).output(cardSchema),
  archive: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
  unarchive: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
  delete: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
  restore: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
  /** Live and not archived; declared active to the contract kit. */
  active: oc.input(z.object({}).strict()).output(z.array(cardSchema)),
  /** Every Live Row, archived ones included. */
  all: oc.input(z.object({}).strict()).output(z.array(cardSchema)),
};
