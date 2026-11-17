// A test module above `projects`, as `time-tracking` will be one: its entries each refer to a
// project. It builds the released project reference into its own answers (D330).

import { oc } from "@orpc/contract";
import { idSchema, refusal } from "@self-engine/db/schema";
import { z } from "zod";
import { projectIdSchema, projectReferenceSchema } from "../../../src/contracts/index.ts";

export const projectEntryIdSchema = idSchema("ProjectEntry");

const projectEntrySchema = z.object({
  id: projectEntryIdSchema,
  label: z.string(),
  projectId: projectIdSchema,
});
const byId = z.strictObject({ id: projectEntryIdSchema });

export const projectEntriesContract = {
  /**
   * Takes the id of an archived project too; for a deleted or unknown one the frame's reference
   * check answers with the Refusal (D337).
   */
  create: oc
    .input(z.strictObject({ projectId: projectIdSchema, label: z.string().min(1) }))
    .output(projectEntrySchema)
    .errors({ ...refusal }),
  delete: oc
    .input(byId)
    .output(projectEntrySchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /** The reference check refuses an entry whose project is deleted (D337). */
  restore: oc
    .input(byId)
    .output(projectEntrySchema)
    .errors({ NOT_FOUND: {}, ...refusal }),
  /** Every entry with its project, sorted by the project's title; `null` for a project not found. */
  list: oc
    .input(z.strictObject({}))
    .output(z.array(projectEntrySchema.extend({ project: projectReferenceSchema.nullable() }))),
};
