import {
  addDuration,
  type BlockMinutes,
  type Duration,
  durationBetween,
  durationSchema,
  endOfBlock,
  type Instant,
  type InstantRange,
  startOfBlock,
  type TimeZone,
  wholeMinuteOf,
} from "@self-engine/time";
import { type Break, type BreakFinding, breakFindings, onWholeSeconds } from "./breaks.ts";
import type { ROUNDING_DIRECTIONS, RoundingRule } from "./rounding-rule.ts";

type RoundingDirection = (typeof ROUNDING_DIRECTIONS)[number];

/**
 * What the computation of a Time Entry takes. Later inputs (the Time Kind, the ordered projects
 * with their Weights) join as further fields.
 */
export interface TimeEntryComputationInput {
  /** The Measured Time: start and end on whole seconds, the end after the start. */
  readonly measuredTime: InstantRange;
  /** The entry's Time Zone, whose clock divides the Blocks of Block Rounding. */
  readonly timeZone: TimeZone;
  /** The entry's Rounding Rule: chosen by hand or looked up by the caller. */
  readonly rule: RoundingRule;
  /** The breaks inside the entry, in the order of its list; empty without any. */
  readonly breaks: readonly Break[];
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
  /**
   * The rules the breaks break, each named by its break; empty when they keep them all. The result
   * stands all the same (reading is lenient), and the Operation refuses a write with any.
   */
  readonly findings: readonly BreakFinding[];
}

/** The Rounded Time and the Booked Duration, before the findings join them. */
type Rounded = Omit<TimeEntryComputation, "findings">;

const earlier = (a: Instant, b: Instant) => (a < b ? a : b);
const later = (a: Instant, b: Instant) => (a > b ? a : b);
const lengthOf = (ranges: readonly InstantRange[]) =>
  ranges.reduce((sum, range) => sum + durationBetween(range.start, range.end), 0);

/**
 * The time the Rest Breaks cover inside the Measured Time, as ranges in time order that neither
 * overlap nor touch. Reading is lenient: the part of a break outside the entry is ignored, and a
 * second that several breaks cover is covered once.
 */
function restCover(measured: InstantRange, breaks: readonly Break[]): InstantRange[] {
  const inside = breaks
    .filter((stretch) => stretch.timeKind === "rest_break")
    .map(onWholeSeconds)
    // Instants of the supported years compare as text in time order.
    .map((stretch) => ({
      start: later(stretch.startedAt, measured.start),
      end: earlier(stretch.endedAt, measured.end),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const cover: InstantRange[] = [];
  for (const range of inside) {
    const last = cover.at(-1);
    if (last !== undefined && range.start <= last.end)
      cover[cover.length - 1] = { start: last.start, end: later(last.end, range.end) };
    else cover.push(range);
  }
  return cover;
}

/** The parts of the Measured Time that count: everything outside the Rest Breaks. */
function countingRanges(measured: InstantRange, cover: readonly InstantRange[]): InstantRange[] {
  const ranges: InstantRange[] = [];
  let from = measured.start;
  for (const range of cover) {
    if (range.start > from) ranges.push({ start: from, end: range.start });
    from = range.end;
  }
  if (measured.end > from) ranges.push({ start: from, end: measured.end });
  return ranges;
}

/** The Blocks in which the counting ranges lie, merged where they meet: each counts in full. */
function countedBlocks(
  counting: readonly InstantRange[],
  minutes: BlockMinutes,
  timeZone: TimeZone,
): InstantRange[] {
  const blocks: InstantRange[] = [];
  for (const range of counting) {
    const block = {
      start: startOfBlock(range.start, minutes, timeZone),
      end: endOfBlock(range.end, minutes, timeZone),
    };
    const last = blocks.at(-1);
    if (last !== undefined && block.start <= last.end)
      blocks[blocks.length - 1] = { start: last.start, end: later(last.end, block.end) };
    else blocks.push(block);
  }
  return blocks;
}

/**
 * The Rounded Time and Booked Duration a rule makes of the Measured Time. The counting time is the
 * measured length without the seconds the Rest Breaks cover; Short Breaks count, and no break is
 * rounded on its own.
 */
function round(
  measured: InstantRange,
  timeZone: TimeZone,
  rule: RoundingRule,
  breaks: readonly Break[],
): Rounded {
  const cover = restCover(measured, breaks);
  const rest = lengthOf(cover);
  const counting = durationSchema.parse(durationBetween(measured.start, measured.end) - rest);
  switch (rule.kind) {
    case "exact":
      return { roundedTime: measured, bookedDuration: counting };
    case "ordinary": {
      const start = wholeMinuteOf(measured.start);
      const bookedDuration = roundSeconds(counting, rule.minutes * 60, rule.direction);
      // The Rest Breaks inside, their sum cut down to the whole minute, lie in the Rounded Time.
      const restMinutes = durationSchema.parse(rest - (rest % 60));
      const end = addDuration(addDuration(start, bookedDuration), restMinutes);
      return { roundedTime: { start, end }, bookedDuration };
    }
    case "block": {
      const start = startOfBlock(measured.start, rule.minutes, timeZone);
      const end = endOfBlock(measured.end, rule.minutes, timeZone);
      // A Block that holds only a Rest Break does not count.
      const blocks = countedBlocks(countingRanges(measured, cover), rule.minutes, timeZone);
      return {
        roundedTime: { start, end },
        bookedDuration: durationSchema.parse(lengthOf(blocks)),
      };
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
 * The one computation of what a Time Entry counts, pure and without storage or clock, so the
 * Operation stores and the page shows the same numbers. The rule rounds the Measured Time first;
 * then the overlap rule takes away what is occupied. A result of 0:00 has no Rounded Time. The
 * findings name the rules the breaks break; the result stands for any list of breaks.
 */
export function computeTimeEntry(input: TimeEntryComputationInput): TimeEntryComputation {
  const findings = breakFindings(input.measuredTime, input.breaks);
  const rounded = round(input.measuredTime, input.timeZone, input.rule, input.breaks);
  const counted = withoutOccupiedTime(rounded, input.occupiedTime ?? []);
  if (counted.bookedDuration === 0)
    return { roundedTime: null, bookedDuration: counted.bookedDuration, findings };
  return { ...counted, findings };
}
