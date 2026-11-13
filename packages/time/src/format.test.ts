import { expect, test } from "vite-plus/test";
import { formatInstant, resolveTimeZone } from "./index.ts";
import { requireInstant } from "./testing.ts";

const zone = (name: string) => resolveTimeZone(name).timeZone;

// The words and digits are asserted exactly; which kind of space the runtime's language data puts
// between them (a narrow no-break space before "PM" in some versions) is not ours to pin.
const shown = (...args: Parameters<typeof formatInstant>): string =>
  formatInstant(...args).replace(/\s/gu, " ");

test.each([
  // A November afternoon: Berlin is an hour east of UTC, New York five hours west.
  ["en", "Europe/Berlin", "2026-11-13T12:30:00.000Z", "Nov 13, 2026, 1:30 PM"],
  ["en", "America/New_York", "2026-11-13T12:30:00.000Z", "Nov 13, 2026, 7:30 AM"],
  ["de", "Europe/Berlin", "2026-11-13T12:30:00.000Z", "13.11.2026, 13:30"],
  ["de", "America/New_York", "2026-11-13T12:30:00.000Z", "13.11.2026, 07:30"],
  // The last minute before Berlin's clocks go forward is still the 29th there, and the 28th in
  // New York; the seconds are cut, not rounded.
  ["en", "Europe/Berlin", "2026-03-29T00:59:59.999Z", "Mar 29, 2026, 1:59 AM"],
  ["en", "America/New_York", "2026-03-29T00:59:59.999Z", "Mar 28, 2026, 8:59 PM"],
  ["de", "Europe/Berlin", "2026-03-29T00:59:59.999Z", "29.03.2026, 01:59"],
  ["de", "America/New_York", "2026-03-29T00:59:59.999Z", "28.03.2026, 20:59"],
] as const)("dateTime in %s, %s: %s is %s", (locale, name, instant, expected) => {
  expect(shown(requireInstant(instant), "dateTime", locale, zone(name))).toBe(expected);
});

test("the zone decides the text, not the device's zone", () => {
  const instant = requireInstant("2026-11-13T23:30:00.000Z");

  expect(shown(instant, "dateTime", "de", zone("Asia/Bangkok"))).toBe("14.11.2026, 06:30");
  expect(shown(instant, "dateTime", "de", zone("Pacific/Honolulu"))).toBe("13.11.2026, 13:30");
});

test("a formatter is kept per locale, zone and format: a second call gives the same text", () => {
  const instant = requireInstant("2026-11-13T12:30:00.000Z");
  const berlin = zone("Europe/Berlin");

  expect(shown(instant, "dateTime", "de", berlin)).toBe("13.11.2026, 13:30");
  expect(shown(instant, "dateTime", "en", berlin)).toBe("Nov 13, 2026, 1:30 PM");
  expect(shown(instant, "dateTime", "de", berlin)).toBe("13.11.2026, 13:30");
});
