import { type InstantRange, instantSchema, wholeSecondOf } from "@self-engine/time";
import { z } from "zod";
import { compareInstants } from "./instant-order.ts";
import { jsonTextSchema } from "./json-text.ts";

/**
 * A Short Break inside a Work Entry: it counts as work. Start and end are Instants on whole
 * seconds, like the entry's, not offsets from its start.
 */
const shortBreakSchema = z.strictObject({
  timeKind: z.literal("short_break"),
  startedAt: instantSchema,
  endedAt: instantSchema,
});

/**
 * A Rest Break inside a Work Entry: it does not count. Only a Rest Break carries the mark "changed
 * by the limit": the limit of a Short Break made it one. The mark is stored and answered; nothing
 * sets it yet.
 */
const restBreakSchema = z.strictObject({
  timeKind: z.literal("rest_break"),
  startedAt: instantSchema,
  endedAt: instantSchema,
  changedByLimit: z.boolean(),
});

/** A Break inside a Work Entry: a Stretch with its Time Kind, told apart by `timeKind`. */
export const breakSchema = z.discriminatedUnion("timeKind", [shortBreakSchema, restBreakSchema]);
export type Break = z.output<typeof breakSchema>;

/**
 * The stored form of the breaks of an entry: a JSON array of breaks in the form of `breakSchema`,
 * in the entry's own row. The table checks that it is a readable array; `decode` checks its
 * content, so text that holds a break this version does not know fails to decode (`safeDecode`).
 */
export const breaksTextSchema = jsonTextSchema(z.array(breakSchema));

/** The Reason of a break that touches an edge of its entry or lies outside it: none is between Work. */
export const BREAK_NOT_BETWEEN_WORK = "break_not_between_work";
/** The Reason of a break that overlaps one that starts before it, or at the same second. */
export const BREAK_OVERLAPS = "break_overlaps";
/** The Reason of a break shorter than one second, on whole seconds. */
export const BREAK_TOO_SHORT = "break_too_short";

/** The Reasons of the rules the breaks of a Work Entry keep. */
export const BREAK_REASONS = [BREAK_NOT_BETWEEN_WORK, BREAK_OVERLAPS, BREAK_TOO_SHORT] as const;

/** A broken rule of one break: its Reason and the break's place in the entry's list. */
export interface BreakFinding {
  readonly reason: (typeof BREAK_REASONS)[number];
  readonly breakIndex: number;
}

/** A break on whole seconds, as the Operation stores it. */
export function onWholeSeconds(stretch: Break): Break {
  return {
    ...stretch,
    startedAt: wholeSecondOf(stretch.startedAt),
    endedAt: wholeSecondOf(stretch.endedAt),
  };
}

/**
 * The rules the breaks of a Work Entry keep (the stretches resolution, point 6), each broken one
 * named by the break it concerns, in the order of the list: a break is at least one second long,
 * lies between Work (it touches neither edge of the entry), and overlaps no break that starts
 * before it; touching is allowed. A break shorter than a second is judged by that rule alone.
 * Compared on whole seconds, as stored.
 */
export function breakFindings(measured: InstantRange, breaks: readonly Break[]): BreakFinding[] {
  const stored = breaks.map((stretch, breakIndex) => ({ ...onWholeSeconds(stretch), breakIndex }));
  const findings: BreakFinding[] = [];
  // Instants of the supported years compare as text in time order.
  for (const { startedAt, endedAt, breakIndex } of stored) {
    if (endedAt <= startedAt) findings.push({ reason: BREAK_TOO_SHORT, breakIndex });
    else if (startedAt <= measured.start || endedAt >= measured.end)
      findings.push({ reason: BREAK_NOT_BETWEEN_WORK, breakIndex });
  }
  // In start order, a break overlaps when it starts before the latest end of those before it.
  const long = stored.filter((stretch) => stretch.endedAt > stretch.startedAt);
  long.sort((a, b) => compareInstants(a.startedAt, b.startedAt));
  let latestEnd: string | undefined;
  for (const { startedAt, endedAt, breakIndex } of long) {
    if (latestEnd !== undefined && startedAt < latestEnd)
      findings.push({ reason: BREAK_OVERLAPS, breakIndex });
    if (latestEnd === undefined || endedAt > latestEnd) latestEnd = endedAt;
  }
  return findings.sort((a, b) => a.breakIndex - b.breakIndex);
}
