import { durationSchema, instantSchema } from "@self-engine/time";
import { z } from "zod";
import { timeEntryIdSchema } from "./ids.ts";
import { projectShareSchema, projectShareWithProjectSchema } from "./project-shares.ts";
import { roundingRuleSchema } from "./rounding-rule.ts";

/** A start and an end, as the Rounded Time of a Time Entry. */
export const instantRangeSchema = z.object({ start: instantSchema, end: instantSchema });

/**
 * The Reason of a finding: the entry's Time Zone, which divides the Blocks of Block Rounding, is
 * unknown to this runtime, so its Blocks were counted in UTC.
 */
export const TIME_ZONE_UNKNOWN = "time_zone_unknown";

/**
 * A rule an entry breaks, found on read and never stored. Reading is lenient: such an entry is
 * still answered with its stored numbers, and the finding marks it for the user to repair.
 */
export const timeEntryFindingSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal(TIME_ZONE_UNKNOWN) }),
]);
export type TimeEntryFinding = z.output<typeof timeEntryFindingSchema>;

/**
 * A Time Entry as the Port answers it. `startedAt` and `endedAt` are its Measured Time, never
 * rounded (D308, D344). The Operation computes the Rounded Time and the Booked Duration from it on
 * every write, with the entry's Rounding Rule (ADR 0044). The creation Time Zone stays in storage.
 */
export const timeEntrySchema = z.object({
  id: timeEntryIdSchema,
  startedAt: instantSchema,
  endedAt: instantSchema,
  /** Where the entry counts and what the app shows; `null` when it counts 0:00. */
  roundedTime: instantRangeSchema.nullable(),
  /** The work that counts, in seconds. */
  bookedDuration: durationSchema,
  /** The rule that made the Rounded Time; `null` for a stored rule this version cannot read. */
  roundingRule: roundingRuleSchema.nullable(),
  /**
   * The mark "rule chosen by hand": the entry's rule when it was chosen by hand instead of the
   * rule that holds, otherwise `null`.
   */
  ruleByHand: roundingRuleSchema.nullable(),
  /** The rules the entry breaks, found on read; empty for an entry that breaks none. */
  findings: z.array(timeEntryFindingSchema),
  /**
   * The projects the entry counts for, the Lead Project first, each with its Weight and its
   * Project Share; empty for an entry without a project. The shares add up to the Booked Duration.
   * Its own name beside the input's `projects`: the Operation computes the shares, so the answer
   * never echoes what an edit sent (ADR 0032).
   */
  projectShares: z.array(projectShareSchema),
  note: z.string().nullable(),
});
export type TimeEntry = z.output<typeof timeEntrySchema>;

/**
 * A Time Entry with the Project Reference of each of its projects (D330), as a Query answers it.
 * An archived or deleted project keeps its marks.
 */
export const timeEntryWithProjectSchema = timeEntrySchema.extend({
  projectShares: z.array(projectShareWithProjectSchema),
});
export type TimeEntryWithProject = z.output<typeof timeEntryWithProjectSchema>;

/**
 * A Time Entry as a list places it: without its rule and its findings, which a list does not
 * show, so a read of many entries parses no rule.
 */
export const listedTimeEntrySchema = timeEntryWithProjectSchema.omit({
  roundingRule: true,
  ruleByHand: true,
  findings: true,
});
export type ListedTimeEntry = z.output<typeof listedTimeEntrySchema>;
