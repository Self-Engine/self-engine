// A test module above `projects`, as `time-tracking` will be one: its entries each refer to a
// project. It builds the released project reference into its own answers (D330).

import { oc } from "@orpc/contract";
import { idSchema } from "@self-engine/db/schema";
import { z } from "zod";
import { projectIdSchema, projectReferenceSchema } from "../../../src/contracts/index.ts";

export const projectEntryIdSchema = idSchema("ProjectEntry");

const projectEntrySchema = z.object({
  id: projectEntryIdSchema,
  label: z.string(),
  projectId: projectIdSchema,
});

export const projectEntriesContract = {
  /** Takes the id of an archived project too; a deleted or unknown one is not found (D330). */
  create: oc
    .input(z.strictObject({ projectId: projectIdSchema, label: z.string().min(1) }))
    .output(projectEntrySchema)
    .errors({ NOT_FOUND: {} }),
  /** Every entry with its project, sorted by the project's title; `null` for a project not found. */
  list: oc
    .input(z.strictObject({}))
    .output(z.array(projectEntrySchema.extend({ project: projectReferenceSchema.nullable() }))),
};
