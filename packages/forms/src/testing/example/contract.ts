// An invented Contract for the example form of the Component Catalog. It belongs to no module and
// no Data Process serves it: the stories answer it with Fixed Answers. Each field is one line of
// `exampleFields`, so a story that needs another field adds its own line.

import { oc } from "@orpc/contract";
import { z } from "zod";

/** The fields of an example entry, as its create Operation takes them. */
const exampleFields = {
  /** Single-line: trimmed, so a title of spaces counts as empty. */
  title: z.string().trim().min(1).max(80),
  /** Multi-line. */
  description: z.string().trim().min(1).max(500),
  /** An icon name or one emoji, or empty; a module's Contract checks it with `entryIconSchema`. */
  icon: z.string().nullable(),
  /** A Color Set name, or empty; a module's Contract checks it with `colorSetNameSchema`. */
  color: z.string().nullable(),
};

/** A stored example entry. Its description may be empty: an edit may clear it. */
export const exampleEntrySchema = z.object({
  id: z.string(),
  ...exampleFields,
  description: exampleFields.description.nullable(),
});

/** The example's Port, mounted as `example` in the stories. */
export const exampleTiedFields = [["icon", "color"]] as const;

export const exampleContract = {
  /** Every example entry: what an edit form shows and follows while it is open (D324). */
  list: oc.input(z.object({})).output(z.array(exampleEntrySchema)),
  // This invented partial input proves the form side only; projects sets the real pattern.
  update: oc
    .input(
      z
        .object({
          id: z.string(),
          title: exampleFields.title.optional(),
          description: exampleFields.description.nullable().optional(),
          icon: z.enum(["circle", "star"]).nullable().optional(),
          color: exampleFields.color.optional(),
        })
        .refine(({ icon, color }) => icon !== "star" || (color !== undefined && color !== null), {
          path: [exampleTiedFields[0][1]],
          params: { reason: "star_needs_color" },
        }),
    )
    .output(exampleEntrySchema),
  create: oc
    .input(
      z.object(exampleFields).refine(({ title, description }) => title !== description, {
        path: ["description"],
        params: { reason: "description_matches_title" },
      }),
    )
    .output(exampleEntrySchema)
    .errors({
      NOT_FOUND: {},
      CONFLICT: { data: z.object({ reason: z.literal("title_taken") }) },
    }),
};
