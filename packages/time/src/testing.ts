import type { Clock } from "./clock.ts";
import { instantSchema, type Instant } from "./instant.ts";

/** A canonical Instant written as text in a deterministic fixture. */
export function requireInstant(text: string): Instant {
  return instantSchema.parse(text);
}

/** A clock that always returns the supplied Instant. */
export function fixedClock(instant: Instant): Clock {
  return () => instant;
}

/** Move a deterministic fixture Instant by whole milliseconds, never by calendar days. */
export function advanceInstantByMilliseconds(instant: Instant, milliseconds: number): Instant {
  return instantSchema.parse(
    Temporal.Instant.from(instant).add({ milliseconds }).toString({ smallestUnit: "millisecond" }),
  );
}
