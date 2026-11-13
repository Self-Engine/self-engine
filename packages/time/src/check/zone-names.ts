import { deviceTimeZone, resolveTimeZone, sameTimeZone } from "../zone.ts";
import type { CheckCase } from "./cases.ts";

const rejected = { thrown: "RangeError" };
const known = (timeZone: string) => ({ timeZone, deviceFallback: false });

/** The resolver table of D282: names keep their spelling, offsets fail, unknown names fall back. */
export const zoneNameCases: readonly CheckCase[] = [
  ...(
    [
      ["Asia/Kolkata", known("Asia/Kolkata")],
      ["Asia/Calcutta", known("Asia/Calcutta")],
      ["Europe/Kyiv", known("Europe/Kyiv")],
      ["Europe/Kiev", known("Europe/Kiev")],
      ["UTC", known("UTC")],
      ["europe/berlin", known("Europe/Berlin")],
      ["america/port-au-prince", known("America/Port-au-Prince")],
      ["Etc/GMT+5", known("Etc/GMT+5")],
      ["+02:00", rejected],
      ["-05:30", rejected],
      ["2026-01-01T00:00[Europe/Berlin]", rejected],
      ["", rejected],
    ] as const
  ).map(([name, expected]) => ({
    name: `resolves ${JSON.stringify(name)}`,
    actual: () => resolveTimeZone(name),
    expected,
  })),
  {
    name: "an unknown name yields the device's zone and says so",
    actual: () => resolveTimeZone("Mars/Olympus"),
    get expected() {
      return { timeZone: deviceTimeZone(), deviceFallback: true };
    },
  },
  ...(
    [
      ["Asia/Calcutta", "Asia/Kolkata", true],
      ["Europe/Kiev", "Europe/Kyiv", true],
      ["UTC", "Etc/UTC", true],
      ["Europe/Berlin", "europe/berlin", true],
      ["Europe/Berlin", "Europe/Paris", false],
      ["America/New_York", "America/Toronto", false],
    ] as const
  ).map(([a, b, expected]) => ({
    name: `${a} and ${b} are ${expected ? "" : "not "}the same zone`,
    actual: () =>
      sameTimeZone(resolveTimeZone(a).timeZone, resolveTimeZone(b).timeZone) &&
      sameTimeZone(resolveTimeZone(b).timeZone, resolveTimeZone(a).timeZone),
    expected,
  })),
];
