import { instantSchema, type Instant } from "../instant.ts";
import { resolveTimeZone, type TimeZone } from "../zone.ts";

/** Every zone name the runtime lists. */
export function listedTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** A listed zone, resolved; `null` when the runtime lists a name it does not resolve. */
export function resolvedListedZones(): Array<{
  readonly name: string;
  readonly timeZone: TimeZone | null;
}> {
  return listedTimeZones().map((name) => {
    const { timeZone, deviceFallback } = resolveTimeZone(name);
    return { name, timeZone: deviceFallback ? null : timeZone };
  });
}

/** The epoch milliseconds of each clock change of a zone from the start of one year to another. */
export function* clockChangesOf(
  timeZone: TimeZone,
  fromYear: number,
  untilYear: number,
): Generator<number> {
  const until = Temporal.Instant.from(`${untilYear}-01-01T00:00:00Z`);
  let cursor: Temporal.ZonedDateTime | null = Temporal.Instant.from(
    `${fromYear}-01-01T00:00:00Z`,
  ).toZonedDateTimeISO(timeZone);
  while ((cursor = cursor.getTimeZoneTransition("next"))) {
    if (Temporal.Instant.compare(cursor.toInstant(), until) >= 0) return;
    yield cursor.epochMilliseconds;
  }
}

/** The Instant of an epoch millisecond in the supported years. */
export function instantAtMs(epochMs: number): Instant {
  return instantSchema.parse(
    Temporal.Instant.fromEpochMilliseconds(epochMs).toString({ fractionalSecondDigits: 3 }),
  );
}
