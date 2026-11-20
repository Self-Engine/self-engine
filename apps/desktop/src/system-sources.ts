// The one place the app assembles the system's time and random sources (ADR 0027). Everything
// below the app takes them as arguments; tests pass fixed ones instead.

import type { DataProcessSources } from "@self-engine/data-process";
import { deviceTimeZone } from "@self-engine/time/device-time-zone";
import { systemClock } from "@self-engine/time/system-clock";

export type SystemSources = DataProcessSources;

/**
 * The system clock, ids made from it and the system's cryptographic random source, and the zone
 * the device runs in.
 */
export function systemSources(): SystemSources {
  return {
    clock: systemClock,
    ids: { clock: systemClock, random: () => crypto.getRandomValues(new Uint8Array(16)) },
    deviceZone: deviceTimeZone,
  };
}
