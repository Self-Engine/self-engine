import { wholeSecondsBetween } from "./borders.ts";
import type { Instant } from "./instant.ts";
import { instantFrom } from "./supported-years.ts";
import { durationSchema, type Duration } from "./values.ts";

/** Cut both endpoints to whole seconds before subtracting, so adjoining entries add up. */
export function durationBetween(from: Instant, to: Instant): Duration {
  if (to < from) throw new RangeError("Duration ends before it starts");
  return durationSchema.parse(wholeSecondsBetween(from, to));
}

/**
 * The Instant cut to its whole second: the milliseconds dropped, toward the past. A stored time
 * entry lies on whole seconds (D344).
 */
export function wholeSecondOf(instant: Instant): Instant {
  return instantFrom(
    Temporal.Instant.from(instant).round({ smallestUnit: "second", roundingMode: "floor" }),
  );
}

/** The Instant a Duration after `instant`: where a range of that length ends. */
export function addDuration(instant: Instant, duration: Duration): Instant {
  return instantFrom(Temporal.Instant.from(instant).add({ seconds: duration }));
}

/** The Instant a Duration before `instant`: where a range of that length that ends there starts. */
export function subtractDuration(instant: Instant, duration: Duration): Instant {
  return instantFrom(Temporal.Instant.from(instant).subtract({ seconds: duration }));
}
