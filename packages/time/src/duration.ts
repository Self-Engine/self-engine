import { epochMsOf } from "./borders.ts";
import type { Instant } from "./instant.ts";
import { durationSchema, type Duration } from "./values.ts";

/** Cut both endpoints to whole seconds before subtracting, so adjoining entries add up. */
export function durationBetween(from: Instant, to: Instant): Duration {
  if (to < from) throw new RangeError("Duration ends before it starts");
  return durationSchema.parse(
    Math.floor(epochMsOf(to) / 1000) - Math.floor(epochMsOf(from) / 1000),
  );
}
