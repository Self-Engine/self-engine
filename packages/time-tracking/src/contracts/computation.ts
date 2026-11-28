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
  /**
   * The entry's projects in their order, the Lead Project first, each with its Weight; none for an
   * entry without a project.
   */
  readonly projects?: readonly { readonly weight: number }[];
}

/** What a Time Entry counts, as the computation answers it. */
export interface TimeEntryComputation {
  /** Where the entry counts; `null` when it counts 0:00. */
  readonly roundedTime: InstantRange | null;
  /** The work that counts, in seconds. */
  readonly bookedDuration: Duration;
  /** The part of the Booked Duration each project gets, in the order of the projects. */
  readonly projectShares: readonly Duration[];
}

/** What a rule makes of the Measured Time, before the Project Shares divide it. */
type Rounded = Omit<TimeEntryComputation, "projectShares">;

/** The Rounded Time and Booked Duration a rule makes of the Measured Time. */
function round(
  measured: InstantRange,
  timeZone: TimeZone,
  rule: RoundingRule,
): Rounded {
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
function withoutOccupiedTime(rounded: Rounded, _occupiedTime: readonly never[]): Rounded {
  return rounded;
}

/**
 * The Project Shares (#404): every further project gets its part of the Booked Duration by Weight,
 * cut down to the whole minute (to the whole second under Exact), and the Lead Project gets the
 * rest. So the shares add up to the Booked Duration exactly, and none is below zero.
 */
function projectSharesOf(
  bookedDuration: Duration,
  rule: RoundingRule,
  projects: readonly { readonly weight: number }[],
): Duration[] {
  const unit = rule.kind === "exact" ? 1 : 60;
  const weights = projects.reduce((sum, { weight }) => sum + weight, 0);
  const further = projects
    .slice(1)
    .map(({ weight }) => Math.floor((bookedDuration * weight) / (weights * unit)) * unit);
  if (projects.length === 0) return [];
  const lead = bookedDuration - further.reduce((sum, share) => sum + share, 0);
  return [lead, ...further].map((share) => durationSchema.parse(share));
}

/**
 * The one computation of what a Time Entry counts, pure and without storage or clock, so the
 * Operation stores and the page shows the same numbers. The rule rounds the Measured Time first;
 * then the overlap rule takes away what is occupied; then the Project Shares divide what counts.
 * A result of 0:00 has no Rounded Time.
 */
export function computeTimeEntry(input: TimeEntryComputationInput): TimeEntryComputation {
  const rounded = round(input.measuredTime, input.timeZone, input.rule);
  const counted = withoutOccupiedTime(rounded, input.occupiedTime ?? []);
  const projectShares = projectSharesOf(counted.bookedDuration, input.rule, input.projects ?? []);
  if (counted.bookedDuration === 0)
    return { roundedTime: null, bookedDuration: counted.bookedDuration, projectShares };
  return { ...counted, projectShares };
}
