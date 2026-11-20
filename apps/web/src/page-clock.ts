// The page's one Clock (ADR 0027, D348): the settings area and every View read the time from it,
// the Views through the hooks of `@self-engine/time/react`. The only file of the page that loads
// the system clock; a test holds that.

import type { Clock } from "@self-engine/time";
import { systemClock } from "@self-engine/time/system-clock";

export const pageClock: Clock = systemClock;
