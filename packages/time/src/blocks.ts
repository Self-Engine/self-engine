import type { Instant } from "./instant.ts";
import { instantFrom } from "./supported-years.ts";
import type { TimeZone } from "./zone.ts";

/** The lengths in minutes that divide the clock's hour, so every hour starts a Block. */
export type BlockMinutes = 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30 | 60;

/** The Instant cut to its whole minute: seconds and milliseconds dropped, toward the past. */
export function wholeMinuteOf(instant: Instant): Instant {
  return instantFrom(
    Temporal.Instant.from(instant).round({ smallestUnit: "minute", roundingMode: "floor" }),
  );
}

function blockBorder(
  instant: Instant,
  minutes: BlockMinutes,
  timeZone: TimeZone,
  direction: "back" | "forward",
): Instant {
  if (!Number.isInteger(minutes) || minutes < 1 || 60 % minutes !== 0)
    throw new RangeError(`No Block of the clock: ${minutes} minutes`);
  const zoned = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  // On the clock the instant shows, in the offset that holds at it, so the hour the clocks
  // repeat stays two hours and is never read in the other offset.
  const offsetMs = zoned.offsetNanoseconds / 1e6;
  const stepMs = minutes * 60_000;
  const clockMs = zoned.epochMilliseconds + offsetMs;
  const round = direction === "back" ? Math.floor : Math.ceil;
  const borderMs = round(clockMs / stepMs) * stepMs - offsetMs;
  // A clock change between the instant and that border ends one Block and begins the next.
  const changeMs = zoned.getTimeZoneTransition(
    direction === "back" ? "previous" : "next",
  )?.epochMilliseconds;
  const cutMs =
    changeMs === undefined
      ? borderMs
      : direction === "back"
        ? Math.max(borderMs, changeMs)
        : Math.min(borderMs, changeMs);
  return instantFrom(Temporal.Instant.fromEpochMilliseconds(cutMs));
}

/**
 * The start of the Block of `minutes` that holds `instant`, on the clock of `timeZone`: Blocks
 * begin at every full hour there and divide it evenly, and a clock change ends one and begins the
 * next. An Instant on a border starts its Block.
 */
export function startOfBlock(instant: Instant, minutes: BlockMinutes, timeZone: TimeZone): Instant {
  return blockBorder(instant, minutes, timeZone, "back");
}

/**
 * The end of the Block of `minutes` in which a range ending at `instant` ends, on the clock of
 * `timeZone`. An Instant on a border is its own end: the range's last moment lies before it.
 */
export function endOfBlock(instant: Instant, minutes: BlockMinutes, timeZone: TimeZone): Instant {
  return blockBorder(instant, minutes, timeZone, "forward");
}
