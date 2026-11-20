// Loadable at the start: it builds its Instant without the schemas of `time`, which would bring
// Zod's full build into the startup bundle (docs/development/performance.md).

import type { Clock } from "./clock.ts";
import type { Instant } from "./instant.ts";
import { inSupportedYears, outOfRange } from "./supported-years.ts";

/**
 * The system time source, loaded only where an application is assembled. `toISOString` writes
 * exactly the stored form of an Instant, `YYYY-MM-DDTHH:MM:SS.sssZ`, for every moment of the
 * supported years 1000–9999, so the brand is given without parsing; a test pins this against
 * `instantSchema`. A system time outside those years throws a RangeError, as every other way to
 * an Instant does.
 */
export const systemClock: Clock = () => {
  const now = Date.now();
  if (!inSupportedYears(now)) outOfRange();
  return new Date(now).toISOString() as Instant;
};
