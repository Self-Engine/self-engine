import {
  addDuration,
  type Duration,
  durationBetween,
  durationSchema,
  endOfBlock,
  type InstantRange,
  startOfBlock,
  type TimeZone,
  wholeMinuteOf,
} from "@self-engine/time";
import type { ROUNDING_DIRECTIONS, RoundingRule } from "./rounding-rule.ts";

type RoundingDirection = (typeof ROUNDING_DIRECTIONS)[number];

/**
 * What the computation of a Time Entry takes. Later inputs (the Time Kind, the breaks, the ordered
 * projects with their Weights) join as further fields.
 */
export interface TimeEntryComputationInput {
  /** The Measured Time: start and end on whole seconds, the end after the start. */
  readonly measuredTime: InstantRange;
  /** The entry's Time Zone, whose clock divides the Blocks of Block Rounding. */
  readonly timeZone: TimeZone;
  /** The entry's Rounding Rule: chosen by hand or looked up by the caller. */
  readonly rule: RoundingRule;
  /**
   * The Occupied Time the overlap rule will take away after the rounding. Until that rule is
   * built, only nothing can be handed in.
   */
  readonly occupiedTime?: readonly never[];
}

/** What a Time Entry counts, as the computation answers it. */
export interface TimeEntryComputation {
  /** Where the entry counts; `null` when it counts 0:00. */
  readonly roundedTime: InstantRange | null;
  /** The work that counts, in seconds. */
  readonly bookedDuration: Duration;
}

/** The Rounded Time and Booked Duration a rule makes of the Measured Time. */
function round(
  measured: InstantRange,
  timeZone: TimeZone,
  rule: RoundingRule,
): TimeEntryComputation {
  switch (rule.kind) {
    case "exact":
      return {
        roundedTime: measured,
        bookedDuration: durationBetween(measured.start, measured.end),
      };
    case "ordinary": {
      const start = wholeMinuteOf(measured.start);
      const bookedDuration = roundSeconds(
        durationBetween(measured.start, measured.end),
        rule.minutes * 60,
        rule.direction,
      );
      return { roundedTime: { start, end: addDuration(start, bookedDuration) }, bookedDuration };
    }
    case "block": {
      const start = startOfBlock(measured.start, rule.minutes, timeZone);
      const end = endOfBlock(measured.end, rule.minutes, timeZone);
      return { roundedTime: { start, end }, bookedDuration: durationBetween(start, end) };
    }
    default:
      return rule satisfies never;
  }
}

/** The counting time in whole steps; exactly half a step rounds up under "to the nearest step". */
function roundSeconds(seconds: Duration, step: number, direction: RoundingDirection): Duration {
  const steps =
    direction === "up"
      ? Math.ceil(seconds / step)
      : direction === "down"
        ? Math.floor(seconds / step)
        : Math.floor((seconds + step / 2) / step);
  return durationSchema.parse(steps * step);
}

/** The place of the overlap rule: it will take the Occupied Time away from the rounded result. */
function withoutOccupiedTime(
  rounded: TimeEntryComputation,
  _occupiedTime: readonly never[],
): TimeEntryComputation {
  return rounded;
}

/**
 * The one computation of what a Time Entry counts, pure and without storage or clock, so the
 * Operation stores and the page shows the same numbers. The rule rounds the Measured Time first;
 * then the overlap rule takes away what is occupied. A result of 0:00 has no Rounded Time.
 */
export function computeTimeEntry(input: TimeEntryComputationInput): TimeEntryComputation {
  const rounded = round(input.measuredTime, input.timeZone, input.rule);
  const counted = withoutOccupiedTime(rounded, input.occupiedTime ?? []);
  if (counted.bookedDuration === 0)
    return { roundedTime: null, bookedDuration: counted.bookedDuration };
  return counted;
}
