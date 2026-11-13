import type { Instant } from "./instant.ts";
import { instantFrom } from "./supported-years.ts";

/** Milliseconds since the Unix epoch, for interfaces such as id generation. */
export function epochMsOf(instant: Instant): number {
  return Temporal.Instant.from(instant).epochMilliseconds;
}

/** Convert a Date received at a foreign interface; invalid and out-of-range dates throw. */
export function instantFromDate(date: Date): Instant {
  return instantFrom(Temporal.Instant.fromEpochMilliseconds(date.getTime()));
}
