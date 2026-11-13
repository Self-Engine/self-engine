import { instantSchema, type Instant } from "../instant.ts";
import { calendarDaySchema, wallClockTimeSchema } from "../values.ts";
import { calendarDayOf, instantAt, wallClockTimeOf } from "../zoned.ts";
import { resolveTimeZone, type TimeZone } from "../zone.ts";

/** Every zone name the runtime lists. */
export function listedTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

export interface IntlComparison {
  readonly transitions: number;
  readonly comparisons: number;
  readonly mismatches: readonly string[];
}

const MINUTE = 60_000;
// Around each clock change: an hour and a second before, the moment itself, and after.
const OFFSETS = [-3_600_000, -1_000, 0, 1_000, 3_600_000];

function intlDayAndTime(format: Intl.DateTimeFormat, epochMs: number): string {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of format.formatToParts(epochMs)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function instantAtMs(epochMs: number): Instant {
  return instantSchema.parse(
    Temporal.Instant.fromEpochMilliseconds(epochMs).toString({ fractionalSecondDigits: 3 }),
  );
}

function compareAt(
  zone: TimeZone,
  format: Intl.DateTimeFormat,
  changeMs: number,
  epochMs: number,
): string[] {
  const instant = instantAtMs(epochMs);
  const expected = intlDayAndTime(format, epochMs);
  const actual = `${calendarDayOf(instant, zone)} ${wallClockTimeOf(instant, zone)}`;
  if (actual !== expected) return [`${zone} ${instant}: Intl ${expected}, time ${actual}`];

  // Back from the day and time Intl shows: the Instant's own minute must be among the answers,
  // and every answer must show that day and time again.
  const [day, time] = expected.split(" ");
  const resolved = instantAt(calendarDaySchema.parse(day), wallClockTimeSchema.parse(time), zone);
  const candidates =
    resolved.case === "repeated" ? [resolved.instant, resolved.later] : [resolved.instant];
  const starts = candidates.map((candidate) => Temporal.Instant.from(candidate).epochMilliseconds);
  const holdsInstant = starts.some((start) => start <= epochMs && epochMs < start + MINUTE);
  const showsAgain = starts.every((start) => intlDayAndTime(format, start) === expected);
  if (resolved.case !== "skipped" && holdsInstant && showsAgain) return [];
  // A change by an offset with seconds (Monrovia, 1972: 44:30) skips the start of a minute
  // whose rest exists: the minute counts as skipped and moves on by the gap.
  const partlySkipped = epochMs >= changeMs && epochMs - changeMs < MINUTE;
  if (resolved.case === "skipped" && partlySkipped) return [];
  return [
    `${zone} ${expected}: Intl shows it at ${instant}, time resolves ${JSON.stringify(resolved)}`,
  ];
}

/**
 * Compares `time` with `Intl` around every clock change of every listed zone in the given years:
 * the day and wall-clock time of each Instant, and the way back from them.
 */
export function compareWithIntl(fromYear = 1970, untilYear = 2040): IntlComparison {
  const until = Temporal.Instant.from(`${untilYear}-01-01T00:00:00Z`);
  const mismatches: string[] = [];
  let transitions = 0;
  let comparisons = 0;
  for (const name of listedTimeZones()) {
    const { timeZone, deviceFallback } = resolveTimeZone(name);
    if (deviceFallback) {
      mismatches.push(`${name}: listed by the runtime, but not resolved`);
      continue;
    }
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    let cursor: Temporal.ZonedDateTime | null = Temporal.Instant.from(
      `${fromYear}-01-01T00:00:00Z`,
    ).toZonedDateTimeISO(timeZone);
    while ((cursor = cursor.getTimeZoneTransition("next"))) {
      if (Temporal.Instant.compare(cursor.toInstant(), until) >= 0) break;
      transitions++;
      for (const offset of OFFSETS) {
        comparisons++;
        mismatches.push(
          ...compareAt(
            timeZone,
            format,
            cursor.epochMilliseconds,
            cursor.epochMilliseconds + offset,
          ),
        );
      }
    }
  }
  return { transitions, comparisons, mismatches };
}
