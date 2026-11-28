// The Day Shares of a Time Entry (D343, ADR 0044): an entry on one Calendar Day has its Booked
// Duration there; one whose Rounded Time crosses midnight in the Time Zone of the call is divided
// over its days here, per day and per project. Pure, so the Query and the Fixed Answers of the
// stories divide alike.
import {
  calendarDayOf,
  type CalendarDay,
  cutAtDays,
  type DayRange,
  dayRangesOf,
  daySpanSchema,
  type Duration,
  durationBetween,
  durationSchema,
  type InstantRange,
  type TimeZone,
} from "@self-engine/time";
import type { ShareUnit } from "../contracts/index.ts";

/** The part of a Time Entry that counts toward one Calendar Day, and each project's part of it. */
export interface DayShare {
  readonly day: CalendarDay;
  readonly seconds: Duration;
  /** The part of each Project Share on this day, in the order of the entry's projects. */
  readonly projectParts: readonly Duration[];
}

/**
 * Whether `range` crosses midnight as seen from `days`, consecutive whole days as `dayRangesOf`
 * gives them: it touches more than one of them, or one of them and a day beyond. A range that
 * touches none of them is not asked about.
 */
export function crossesMidnight(range: InstantRange, days: readonly DayRange[]): boolean {
  const pieces = cutAtDays(range, days);
  const first = days[0];
  const last = days.at(-1);
  if (pieces.length !== 1 || first === undefined || last === undefined) return pieces.length > 1;
  // Beyond the days lie only other days: a part outside them is a part on another day.
  return range.start < first.start || range.end > last.end;
}

const cutDown = (seconds: number, unit: ShareUnit) => Math.floor(seconds / unit) * unit;

/**
 * Proposal 7 of #420: every day but the last gets its part cut down to `unit` (a minute, a second
 * under Exact), never more than is left of `total`, and the last day gets the rest. So the shares
 * add up to `total` exactly, and none is below zero.
 */
export function divideOverDays(parts: readonly number[], total: number, unit: ShareUnit): Duration[] {
  let left = total;
  return parts.map((part, index) => {
    const share = index === parts.length - 1 ? left : Math.min(left, cutDown(part, unit));
    left -= share;
    return durationSchema.parse(Math.max(0, share));
  });
}

/**
 * The part of each Project Share on each day, so that per day the parts add up to the Day Share
 * and per project to the Project Share, on whole `unit`s and never below zero. Every day but the
 * last gives each project its part of the day by its share, cut down to the unit; what is left of
 * the day goes to the projects in their order, the Lead Project first, as far as their shares
 * reach; the last day gets what is left of each share. The shares are taken to add up to the Day
 * Shares' total; data that does not (reading is lenient) still gets parts, none below zero.
 */
export function divideProjectShares(
  dayShares: readonly number[],
  projectShares: readonly number[],
  unit: ShareUnit,
): Duration[][] {
  const total = projectShares.reduce((sum, share) => sum + share, 0);
  const before = dayShares.slice(0, -1);
  const parts = before.map((day) =>
    projectShares.map((share) => (total === 0 ? 0 : cutDown((day * share) / total, unit))),
  );
  // What is left of each share once every day before the last has its parts cut down.
  const left = projectShares.map(
    (share, project) => share - parts.reduce((sum, day) => sum + (day[project] ?? 0), 0),
  );
  for (const [index, day] of before.entries()) {
    const dayParts = parts[index] ?? [];
    let missing = day - dayParts.reduce((sum, part) => sum + part, 0);
    for (const project of projectShares.keys()) {
      const added = Math.max(0, Math.min(missing, left[project] ?? 0));
      dayParts[project] = (dayParts[project] ?? 0) + added;
      left[project] = (left[project] ?? 0) - added;
      missing -= added;
    }
  }
  return [...parts, left].map((day) => day.map((part) => durationSchema.parse(Math.max(0, part))));
}

/** What the division of one entry across midnight takes. */
export interface DividedEntry {
  readonly roundedTime: InstantRange;
  readonly bookedDuration: Duration;
  /** Its Project Shares in the order of its projects; none without a project. */
  readonly projectShares: readonly Duration[];
  /** Where its Booked Duration lies, as `countedRanges` gives it. */
  readonly counted: readonly InstantRange[];
  /** The unit of its shares, `shareUnitOf` its rule. */
  readonly unit: ShareUnit;
}

/**
 * The Day Shares of an entry whose Rounded Time crosses midnight in `timeZone`, the Time Zone of
 * the call: one on each day its Rounded Time touches, in order, inside a span or not, so a span
 * counts the same part of an entry as every other span. Each day's part is what of `counted` lies
 * on it, divided with `divideOverDays`; the Project Shares are divided with `divideProjectShares`.
 */
export function divideOverItsDays(entry: DividedEntry, timeZone: TimeZone): DayShare[] {
  const { roundedTime, bookedDuration, projectShares, counted, unit } = entry;
  const span = daySpanSchema.parse({
    first: calendarDayOf(roundedTime.start, timeZone),
    last: calendarDayOf(roundedTime.end, timeZone),
  });
  const days = dayRangesOf(span, timeZone).filter(
    (day) => cutAtDays(roundedTime, [day]).length > 0,
  );
  const parts = days.map(() => 0);
  for (const range of counted)
    for (const piece of cutAtDays(range, days)) {
      const index = days.findIndex(({ day }) => day === piece.day);
      parts[index] = (parts[index] ?? 0) + durationBetween(piece.start, piece.end);
    }
  const seconds = divideOverDays(parts, bookedDuration, unit);
  const projectParts = divideProjectShares(seconds, projectShares, unit);
  return days.map(({ day }, index) => ({
    day,
    seconds: seconds[index] ?? durationSchema.parse(0),
    projectParts: projectParts[index] ?? [],
  }));
}
