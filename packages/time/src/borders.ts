import type { Instant } from "./instant.ts";
import { instantFrom } from "./supported-years.ts";

/** Milliseconds since the Unix epoch, for interfaces such as id generation. */
export function epochMsOf(instant: Instant): number {
  return Temporal.Instant.from(instant).epochMilliseconds;
}

/**
 * The whole seconds from `from` to `to`, both cut to their second first, so adjoining ranges add
 * up; negative when `to` lies before `from`.
 */
export function wholeSecondsBetween(from: Instant, to: Instant): number {
  return Math.floor(epochMsOf(to) / 1000) - Math.floor(epochMsOf(from) / 1000);
}

/** Convert a Date received at a foreign interface; invalid and out-of-range dates throw. */
export function instantFromDate(date: Date): Instant {
  return instantFrom(Temporal.Instant.fromEpochMilliseconds(date.getTime()));
}
