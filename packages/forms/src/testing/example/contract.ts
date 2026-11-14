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
};

export const exampleEntrySchema = z.object({ id: z.string(), ...exampleFields });

/** The example's Port, mounted as `example` in the stories. */
export const exampleContract = {
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
