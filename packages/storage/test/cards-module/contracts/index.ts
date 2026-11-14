// Test-only reference for the edit pattern (D329, ADR 0032); no runtime entry imports it.
import { oc } from "@orpc/contract";
import { entryFields, idSchema } from "@self-engine/db/schema";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";

export const cardIdSchema = idSchema("Card");

/** A card's fields, once: the inputs of create and edit are derived from them. */
export const cardFields = entryFields(cardIdSchema, {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10_000).nullable(),
  color: z.enum(["red", "blue"]).nullable(),
});

/** The rule that ties title and body, checked when both travel (D323). */
export const bodyDiffers = ({
  title,
  body,
}: {
  title?: string | undefined;
  body?: string | null | undefined;
}) => title === undefined || body === undefined || body !== title;
export const bodyRule = { path: ["body"], params: { reason: "body_matches_title" } };
/** The fields the rule ties: an edit form sends them together. */
export const cardTiedFields = [["title", "body"]] as const;

export const cardSchema = z.object({
  id: cardIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  title: z.string(),
  body: z.string().nullable(),
  color: z.string().nullable(),
});
const byId = z.strictObject({ id: cardIdSchema });

export const cardsContract = {
  list: oc.input(z.strictObject({})).output(z.array(cardSchema)),
  create: oc.input(cardFields.create.refine(bodyDiffers, bodyRule)).output(cardSchema),
  edit: oc
    .input(cardFields.edit.refine(bodyDiffers, bodyRule))
    .output(cardSchema)
    .errors({ NOT_FOUND: {} }),
  delete: oc.input(byId).output(cardSchema).errors({ NOT_FOUND: {} }),
};
