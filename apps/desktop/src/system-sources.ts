// The one place the app assembles the system's time and random sources (ADR 0027). Everything
// below the app takes them as arguments; tests pass fixed ones instead.

import type { IdSources } from "@self-engine/db";
import type { Clock } from "@self-engine/time";
import { systemClock } from "@self-engine/time/system-clock";

export interface SystemSources {
  readonly clock: Clock;
  readonly ids: IdSources;
}

/** The system clock, and ids made from it and the system's cryptographic random source. */
export function systemSources(): SystemSources {
  return {
    clock: systemClock,
    ids: { clock: systemClock, random: () => crypto.getRandomValues(new Uint8Array(16)) },
  };
}
