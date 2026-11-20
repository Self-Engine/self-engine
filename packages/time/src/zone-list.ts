// The list a user picks a Time Zone from. An entry of its own (`@self-engine/time/zone-list`):
// it asks the runtime for all its zones, so it loads with the row that shows them and never at
// the start of the app (the startup check holds it).

import type { Instant } from "./instant.ts";
import { utcOffsetText } from "./utc-offset.ts";
import { sameTimeZone, type TimeZone } from "./zone.ts";

/** One zone of the list, as the picker shows it. */
export interface TimeZoneChoice {
  /** The runtime's name, or the shown zone's spelling (D282). The value a pick stores. */
  readonly timeZone: TimeZone;
  /** The last part of the name, with spaces: `Buenos Aires`. */
  readonly place: string;
  /** The offset from UTC at the given Instant: `UTC+1`, `UTC-3:30`, `UTC+0`. */
  readonly offset: string;
}

/** The zones the runtime knows, and UTC, which it may leave out. Names only, no arithmetic. */
function runtimeZones(): readonly TimeZone[] {
  // The runtime's own names: each is one it resolves, so each is a TimeZone.
  const names = Intl.supportedValuesOf("timeZone") as TimeZone[];
  return names.includes("UTC" as TimeZone) ? names : [...names, "UTC" as TimeZone];
}

function placeOf(name: string): string {
  return (name.split("/").at(-1) ?? name).replaceAll("_", " ");
}

/**
 * The places of all zones, for the settings search: cheap, because it computes no offset, so the
 * search can hold it from the moment the settings open.
 */
export function timeZonePlaces(): readonly string[] {
  return runtimeZones().map(placeOf);
}

interface Sortable extends TimeZoneChoice {
  readonly nanoseconds: number;
}

function choiceOf(timeZone: TimeZone, now: Temporal.Instant): Sortable {
  const nanoseconds = now.toZonedDateTimeISO(timeZone).offsetNanoseconds;
  return {
    timeZone,
    place: placeOf(timeZone),
    offset: utcOffsetText(nanoseconds / 60e9),
    nanoseconds,
  };
}

// By code unit, so that the order is the same in every language and on every device.
const byOffsetThenPlace = (a: Sortable, b: Sortable) =>
  a.nanoseconds - b.nanoseconds || (a.place < b.place ? -1 : a.place > b.place ? 1 : 0);

/**
 * Every zone of the runtime and UTC, with the offset that holds at `now`, sorted by offset and
 * then by place. `shown` is always in the list in its own spelling: in place of the runtime's
 * other name for the same zone (compared through `time`, never as text), or added when the
 * runtime lists it under no name. Some 420 entries, built in about 0.5–0.6 ms in Chromium and
 * about 2 ms in Node (#364).
 */
export function timeZoneChoices(now: Instant, shown: TimeZone): readonly TimeZoneChoice[] {
  const instant = Temporal.Instant.from(now);
  const zones = runtimeZones();
  const named = zones.includes(shown);
  let replaced = named;
  const choices = zones.map((name) => {
    if (!replaced && sameTimeZone(name, shown)) {
      replaced = true;
      return choiceOf(shown, instant);
    }
    return choiceOf(name, instant);
  });
  if (!replaced) choices.push(choiceOf(shown, instant));
  return choices
    .toSorted(byOffsetThenPlace)
    .map(({ timeZone, place, offset }) => ({ timeZone, place, offset }));
}
