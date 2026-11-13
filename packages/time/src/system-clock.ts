import { instantFromDate } from "./borders.ts";
import type { Clock } from "./clock.ts";

/** The system time source, loaded only where an application is assembled. */
export const systemClock: Clock = () => instantFromDate(new Date(Date.now()));
