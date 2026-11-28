import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { durationSchema } from "@self-engine/time";
import { z } from "zod";

/** The smallest Weight: equal parts are 1 : 1. */
export const WEIGHT_MIN = 1;
/** The largest Weight, so "33.33 %" can still be stated in hundredths. */
export const WEIGHT_MAX = 10_000;

/** The Reason of a Weight that is no whole number from `WEIGHT_MIN` to `WEIGHT_MAX`. */
export const WEIGHT_OUT_OF_RANGE = "weight_out_of_range";
/** The Reason of a project that stands twice in the list of one entry, at its second place. */
export const PROJECT_NAMED_TWICE = "project_named_twice";

/** What the user states for a project of an entry: a whole number from 1 to 10,000. */
export const weightSchema = z
  .number()
  .refine((weight) => Number.isInteger(weight) && weight >= WEIGHT_MIN && weight <= WEIGHT_MAX, {
    params: { reason: WEIGHT_OUT_OF_RANGE },
  });

/**
 * The projects of an entry as create and edit take them: the Lead Project first. A project without
 * a Weight has the Weight 1, so a list without Weights divides in equal parts. A project stands in
 * the list once. The Project Shares are computed and never an input (D346).
 */
export const projectsInputSchema = z
  .array(z.strictObject({ projectId: projectIdSchema, weight: weightSchema.optional() }))
  .superRefine((projects, context) => {
    const seen = new Set<string>();
    for (const [index, { projectId }] of projects.entries()) {
      if (seen.has(projectId))
        context.addIssue({
          code: "custom",
          path: [index, "projectId"],
          params: { reason: PROJECT_NAMED_TWICE },
        });
      seen.add(projectId);
    }
  });

/** One project of an entry as an answer carries it: its Weight and its Project Share in seconds. */
export const projectShareSchema = z.object({
  projectId: projectIdSchema,
  weight: z.number().int(),
  projectShare: durationSchema,
});
export type ProjectShare = z.output<typeof projectShareSchema>;

/** The same with its Project Reference (D330), as a Query answers it. */
export const projectShareWithProjectSchema = projectShareSchema.extend({
  project: projectReferenceSchema,
});
export type ProjectShareWithProject = z.output<typeof projectShareWithProjectSchema>;
