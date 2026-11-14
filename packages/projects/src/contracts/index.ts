import { oc } from "@orpc/contract";
import { entryFields } from "@self-engine/db/schema";
import { entryIconSchema } from "@self-engine/icons/names";
import { colorSetNameSchema } from "@self-engine/theme/names";
import { instantSchema } from "@self-engine/time";
import { z } from "zod";
import { projectIdSchema } from "./project-id.ts";

export { projectIdSchema };
export { type ProjectReference, projectReferenceSchema } from "./project-reference.ts";

/** The longest title, in characters after trimming. */
export const TITLE_MAX = 200;
/** The longest description, in characters after trimming. */
export const DESCRIPTION_MAX = 10_000;

/**
 * A project's fields, once: the inputs of create and edit are derived from them (D329, ADR 0032).
 * Only the title is required. A description of spaces is no value, as an empty one is. Icon and
 * color are written strictly and read as stored text (ADR 0029).
 */
export const projectFields = entryFields(projectIdSchema, {
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX)
    .transform((text) => (text === "" ? null : text))
    .nullable(),
  icon: z.nullable(entryIconSchema),
  color: z.nullable(colorSetNameSchema),
});

/** A project as the Port answers it. Icon and color are the stored text, not checked. */
export const projectSchema = z.object({
  id: projectIdSchema,
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  archivedAt: instantSchema.nullable(),
});

const byId = z.strictObject({ id: projectIdSchema });

/**
 * The module's Port (D252): mounted as `projects` in the app contract. A project is its id: no
 * title is unique, so no Operation answers with a Conflict (D328).
 */
export const projectsContract = {
  /** The Live Rows that are not archived: a small set, sorted by title in the page. */
  active: oc.input(z.strictObject({})).output(z.array(projectSchema)),
  /** The archived Live Rows: a small set, sorted by title in the page as "Active" is. */
  archived: oc.input(z.strictObject({})).output(z.array(projectSchema)),
  create: oc.input(projectFields.create).output(projectSchema),
  /** The edit pattern (D329): a missing field stays, `null` clears, an edit without fields reads. */
  edit: oc.input(projectFields.edit).output(projectSchema).errors({ NOT_FOUND: {} }),
  /**
   * Archive and unarchive lock nothing and answer with the project. Archiving an archived project,
   * or unarchiving an active one, changes nothing and is no error (D327).
   */
  archive: oc.input(byId).output(projectSchema).errors({ NOT_FOUND: {} }),
  unarchive: oc.input(byId).output(projectSchema).errors({ NOT_FOUND: {} }),
  /** A soft delete; `restore` is its undo and brings the project back as it was, archived or not. */
  delete: oc.input(byId).output(projectSchema).errors({ NOT_FOUND: {} }),
  restore: oc.input(byId).output(projectSchema).errors({ NOT_FOUND: {} }),
};
