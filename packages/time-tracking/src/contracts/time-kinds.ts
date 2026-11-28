import { z } from "zod";

/** The Time Kinds of an entry that is not work: a Break Entry or a Leisure Entry. */
export const NOT_WORK_KINDS = ["short_break", "rest_break", "leisure"] as const;

/**
 * What a Time Entry is for the count: Work, Short Break, Rest Break or Leisure. A Work Entry
 * carries breaks and projects; an entry that is not work carries neither.
 */
export const TIME_KINDS = ["work", ...NOT_WORK_KINDS] as const;

export const timeKindSchema = z.enum(TIME_KINDS);
export type TimeKind = z.output<typeof timeKindSchema>;
export type NotWorkKind = (typeof NOT_WORK_KINDS)[number];

/** The Reason of a list of breaks on an entry that is not work, at the breaks. */
export const NOT_WORK_HAS_BREAKS = "not_work_has_breaks";
/** The Reason of projects on an entry that is not work, at the projects. */
export const NOT_WORK_HAS_PROJECTS = "not_work_has_projects";
/**
 * The Reason of a rule chosen by hand for an entry that is not work, at the rule: such an entry
 * takes the app-wide rule.
 */
export const NOT_WORK_HAS_RULE_BY_HAND = "not_work_has_rule_by_hand";

/** Whether the time of an entry of this kind counts toward the Booked Duration. */
export const timeKindCounts = (timeKind: TimeKind) =>
  timeKind === "work" || timeKind === "short_break";
