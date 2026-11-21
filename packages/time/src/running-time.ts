// The running time of something that started at an Instant, such as a timer, as text. Its own
// entry of `time` (`@self-engine/time/running-time`) without a schema, so code that loads early,
// such as a Module Indicator, does not bring the package's Zod schemas with it.

import { wholeSecondsBetween } from "./borders.ts";
import { formatDuration } from "./format.ts";
import type { Instant } from "./instant.ts";
import type { Duration } from "./values.ts";

/**
 * The time from `start` to `now` in hours, minutes and seconds, such as `1:12:47`, cut to whole
 * seconds as a Duration is. A `now` before the start, as after the clock jumped back, shows
 * `0:00:00` rather than a negative time.
 */
export function formatRunningTime(start: Instant, now: Instant, locale: string): string {
  // Never negative and a whole number of seconds: what the Duration schema would accept.
  const elapsed = Math.max(0, wholeSecondsBetween(start, now)) as Duration;
  return formatDuration(elapsed, "hoursMinutesSeconds", locale);
}
