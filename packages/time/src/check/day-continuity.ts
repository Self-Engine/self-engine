import { calendarDayOf, instantRangeOf } from "../zoned.ts";
import { clockChangesOf, instantAtMs, resolvedListedZones } from "./clock-changes.ts";

export interface DayContinuity {
  readonly clockChanges: number;
  readonly breaks: readonly string[];
}

// Around each clock change: an hour and a millisecond before, the moment itself, and after.
const OFFSETS = [-3_600_000, -1, 0, 1, 1_800_000, 3_600_000];

/**
 * Checks that an Instant lies inside the range of its own calendar day, around every clock change
 * of every listed zone in the given years. Until 2010 four zones turned the clock back across
 * midnight, so a day there was not one continuous range (ADR 0026); from 2011 on none did, and a
 * runtime whose zone data breaks a day again fails here.
 */
export function checkDayContinuity(fromYear = 2011, untilYear = 2040): DayContinuity {
  const breaks: string[] = [];
  let clockChanges = 0;
  for (const { name, timeZone } of resolvedListedZones()) {
    if (timeZone === null) {
      breaks.push(`${name}: listed by the runtime, but not resolved`);
      continue;
    }
    for (const changeMs of clockChangesOf(timeZone, fromYear, untilYear)) {
      clockChanges++;
      for (const offset of OFFSETS) {
        const instant = instantAtMs(changeMs + offset);
        const day = calendarDayOf(instant, timeZone);
        const { start, end } = instantRangeOf(day, timeZone);
        if (instant < start || instant >= end)
          breaks.push(`${timeZone} ${instant}: on ${day}, outside its range ${start} to ${end}`);
      }
    }
  }
  return { clockChanges, breaks };
}
