import { durationSchema, instantSchema } from "@self-engine/time";
import { z } from "zod";
import { BREAK_REASONS, breakSchema } from "./breaks.ts";
import { timeEntryIdSchema } from "./ids.ts";
import { projectShareSchema, projectShareWithProjectSchema } from "./project-shares.ts";
import { roundingRuleSchema } from "./rounding-rule.ts";
import { NOT_WORK_HAS_BREAKS, NOT_WORK_HAS_PROJECTS, NOT_WORK_KINDS } from "./time-kinds.ts";

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
  /** A break that breaks a rule of the breaks, named by its place in the entry's list. */
  z.object({ reason: z.enum(BREAK_REASONS), breakIndex: z.number().int().nonnegative() }),
  /** Breaks or projects on an entry that is not work, which has neither. */
  z.object({ reason: z.enum([NOT_WORK_HAS_BREAKS, NOT_WORK_HAS_PROJECTS]) }),
]);
export type TimeEntryFinding = z.output<typeof timeEntryFindingSchema>;

/**
 * What every Time Entry carries, whatever its Time Kind. `startedAt` and `endedAt` are its
 * Measured Time, never rounded (D308, D344). The Operation computes the Rounded Time and the
 * Booked Duration from it on every write (ADR 0044). The creation Time Zone stays in storage.
 */
const entryShape = {
  id: timeEntryIdSchema,
  startedAt: instantSchema,
  endedAt: instantSchema,
  /** Where the entry counts and what the app shows; `null` when it counts 0:00. */
  roundedTime: instantRangeSchema.nullable(),
  /** The work that counts, in seconds: 0 for a Rest Break and for Leisure. */
  bookedDuration: durationSchema,
  /** The rules the entry breaks, found on read; empty for an entry that breaks none. */
  findings: z.array(timeEntryFindingSchema),
  note: z.string().nullable(),
};

/**
 * A Work Entry: its rule, its breaks and its projects, which an entry that is not work never
 * carries.
 */
export const workEntrySchema = z.object({
  timeKind: z.literal("work"),
  ...entryShape,
  /** The rule that made the Rounded Time; `null` for a stored rule this version cannot read. */
  roundingRule: roundingRuleSchema.nullable(),
  /**
   * The mark "rule chosen by hand": the entry's rule when it was chosen by hand instead of the
   * rule that holds, otherwise `null`.
   */
  ruleByHand: roundingRuleSchema.nullable(),
  /** The breaks inside the entry, as stored; `null` for a list this version cannot read. */
  breaks: z.array(breakSchema).nullable(),
  /**
   * The projects the entry counts for, the Lead Project first, each with its Weight and its
   * Project Share; empty for an entry without a project. The shares add up to the Booked Duration.
   */
  projects: z.array(projectShareSchema),
});
export type WorkEntry = z.output<typeof workEntrySchema>;

/**
 * An entry that is not work: a Break Entry or a Leisure Entry, without breaks and projects. The
 * app-wide rule rounds its length. Only a Rest Break carries the mark "changed by the limit": the
 * limit of a Short Break made it one. The mark is stored and answered; nothing sets it yet.
 */
export const notWorkEntrySchema = z.discriminatedUnion("timeKind", [
  z.object({ timeKind: z.enum(["short_break", "leisure"]), ...entryShape }),
  z.object({ timeKind: z.literal("rest_break"), ...entryShape, changedByLimit: z.boolean() }),
]);
export type NotWorkEntry = z.output<typeof notWorkEntrySchema>;

/** A Time Entry as the Port answers it: a union of two shapes, told apart by its Time Kind. */
export const timeEntrySchema = z.discriminatedUnion("timeKind", [
  workEntrySchema,
  notWorkEntrySchema,
]);
export type TimeEntry = z.output<typeof timeEntrySchema>;

/**
 * A Time Entry with the Project Reference of each of its projects (D330), as a Query answers it.
 * An archived or deleted project keeps its marks.
 */
export const timeEntryWithProjectSchema = z.discriminatedUnion("timeKind", [
  workEntrySchema.extend({ projects: z.array(projectShareWithProjectSchema) }),
  notWorkEntrySchema,
]);
export type TimeEntryWithProject = z.output<typeof timeEntryWithProjectSchema>;

/** What a list shows of every entry: never its findings, nor a Rest Break's mark. */
const listedShape = {
  id: entryShape.id,
  startedAt: entryShape.startedAt,
  endedAt: entryShape.endedAt,
  roundedTime: entryShape.roundedTime,
  bookedDuration: entryShape.bookedDuration,
  note: entryShape.note,
};

/**
 * A Time Entry as a list places it: without its rule, its findings and its breaks, which a list
 * does not show, so a read of many entries parses neither the rule nor the breaks. A Work Entry
 * keeps its projects.
 */
export const listedTimeEntrySchema = z.discriminatedUnion("timeKind", [
  z.object({
    timeKind: z.literal("work"),
    ...listedShape,
    projects: z.array(projectShareWithProjectSchema),
  }),
  z.object({ timeKind: z.enum(NOT_WORK_KINDS), ...listedShape }),
]);
export type ListedTimeEntry = z.output<typeof listedTimeEntrySchema>;
