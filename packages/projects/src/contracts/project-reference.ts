import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { projectIdSchema } from "./project-id.ts";

/**
 * The project reference (D330): what a module above `projects` needs to show a project and to know
 * its state. The Read Piece `projectReferences` of `./data` gives exactly these six fields, and a
 * module above builds this schema into its own answers. They are released: `projects` renames
 * none of them without touching every module above. Icon and color are the stored text, as the
 * Entry Mark reads them (ADR 0029). A project may be archived and deleted at once.
 */
export const projectReferenceSchema = z.strictObject({
  id: projectIdSchema,
  title: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  /** The archive mark: when the project was archived, or `null` while it is active. */
  archivedAt: instantSchema.nullable(),
  /** The deletion mark: when the project was deleted, or `null` while it is a Live Row. */
  deletedAt: instantSchema.nullable(),
});

/** A project as a module above refers to it. */
export type ProjectReference = z.output<typeof projectReferenceSchema>;
