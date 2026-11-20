// Zod's core only as a type: the Settings entry loads this file at startup, where Zod's full
// build may not (docs/development/performance.md). `$brand` is what `z.BRAND` names.
import type { $brand } from "zod/v4/core";

/** A zone name this runtime knows, in its official spelling; made only by `resolveTimeZone`. */
export type TimeZone = string & $brand<"TimeZone">;

/** The zone of a resolved name; `deviceFallback` says the runtime did not know the name. */
export interface ResolvedTimeZone {
  readonly timeZone: TimeZone;
  readonly deviceFallback: boolean;
}

// An IANA name or link: letters first, no offset, no date-time string with a zone annotation.
export const NAME_SHAPE = /^[A-Za-z][\w+-]*(?:\/[A-Za-z][\w+-]*)*$/;

function officialSpelling(name: string): string | undefined {
  try {
    return new Temporal.ZonedDateTime(0n, name).timeZoneId;
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

/**
 * The only way to a `TimeZone`. Offsets such as `+02:00` and text that is no zone name throw a
 * RangeError; a well-formed name the runtime does not know yields the device's zone and says so.
 */
export function resolveTimeZone(name: string): ResolvedTimeZone {
  return resolveTimeZoneOr(name, deviceTimeZone);
}

/**
 * `resolveTimeZone` with the device's zone handed in, for a caller that gets it as a source (the
 * Data Process) instead of asking the runtime. Internal to `time`: its entries build on it.
 */
export function resolveTimeZoneOr(name: string, device: () => TimeZone): ResolvedTimeZone {
  if (!NAME_SHAPE.test(name)) throw new RangeError(`Not a time zone name: ${JSON.stringify(name)}`);
  const spelled = officialSpelling(name);
  if (spelled === undefined) return { timeZone: device(), deviceFallback: true };
  return { timeZone: spelled as TimeZone, deviceFallback: false };
}

/** Whether two names denote one zone, aliases included (`Asia/Calcutta` is `Asia/Kolkata`). */
export function sameTimeZone(a: TimeZone, b: TimeZone): boolean {
  return new Temporal.ZonedDateTime(0n, a).equals(new Temporal.ZonedDateTime(0n, b));
}

/** The zone the device runs in: the only place where it enters the program. */
export function deviceTimeZone(): TimeZone {
  const id = Temporal.Now.timeZoneId();
  // A device set to a bare offset has no zone name; UTC is the one zone without clock changes.
  return (NAME_SHAPE.test(id) ? id : "UTC") as TimeZone;
}
