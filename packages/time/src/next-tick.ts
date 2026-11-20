// When the page clock next has something new to show (D348): the next full second or minute,
// and the start of the next day. Pure, and free of the schemas of `time` like `zoned-day.ts`.
import { epochMsOf } from "./borders.ts";
import type { Instant } from "./instant.ts";
import { calendarDayFrom, instantFrom } from "./supported-years.ts";
import type { TimeZone } from "./zone.ts";
import { startOfCalendarDay, zonedOf } from "./zoned-day.ts";

/** How often a reading of "now" changes. */
export type TickStep = "second" | "minute";

const STEP_MILLISECONDS: Readonly<Record<TickStep, number>> = { second: 1000, minute: 60_000 };

/**
 * The next full second or minute strictly after `instant`. A full minute of UTC is a full minute
 * on the clocks of every zone in use since 1972, whose offsets are whole minutes; so the step
 * needs no Time Zone.
 */
export function nextTick(instant: Instant, step: TickStep): Instant {
  const length = STEP_MILLISECONDS[step];
  const next = (Math.floor(epochMsOf(instant) / length) + 1) * length;
  return instantFrom(Temporal.Instant.fromEpochMilliseconds(next));
}

/** The first moment of the day after the one `instant` falls on in `timeZone`; not always 00:00. */
export function startOfNextDay(instant: Instant, timeZone: TimeZone): Instant {
  const dayAfter = zonedOf(instant, timeZone).toPlainDate().add({ days: 1 });
  return startOfCalendarDay(calendarDayFrom(dayAfter), timeZone);
}
