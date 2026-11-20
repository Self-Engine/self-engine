import { expect, test } from "vite-plus/test";
import { resolveTimeZone, sameTimeZone, type TimeZone } from "./index.ts";
import { requireInstant } from "./testing.ts";
import { timeZoneChoices, timeZonePlaces } from "./zone-list.ts";

const WINTER = requireInstant("2026-11-20T10:00:00.000Z");
const SUMMER = requireInstant("2026-07-01T10:00:00.000Z");
const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BERLIN = zone("Europe/Berlin");

const choiceOf = (choices: ReturnType<typeof timeZoneChoices>, name: string) =>
  choices.find((choice) => choice.timeZone === name);

test("each zone shows its place and the offset from UTC that holds now", () => {
  const winter = timeZoneChoices(WINTER, BERLIN);
  expect(choiceOf(winter, "Europe/Berlin")).toEqual({
    timeZone: "Europe/Berlin",
    place: "Berlin",
    offset: "UTC+1",
  });
  expect(choiceOf(timeZoneChoices(SUMMER, BERLIN), "Europe/Berlin")?.offset).toBe("UTC+2");
});

test.each([
  ["America/Argentina/Buenos_Aires", "Buenos Aires", "UTC-3"],
  ["Asia/Kathmandu", "Kathmandu", "UTC+5:45"],
  ["America/St_Johns", "St Johns", "UTC-3:30"],
  ["Africa/Abidjan", "Abidjan", "UTC+0"],
])("%s shows as %s, %s", (name, place, offset) => {
  // Shown, so that it stands in the list whatever this runtime calls it.
  expect(choiceOf(timeZoneChoices(WINTER, zone(name)), name)).toEqual({
    timeZone: name,
    place,
    offset,
  });
});

test("the list holds UTC", () => {
  expect(choiceOf(timeZoneChoices(WINTER, BERLIN), "UTC")).toEqual({
    timeZone: "UTC",
    place: "UTC",
    offset: "UTC+0",
  });
});

test("the list is the runtime's zones plus UTC, each once", () => {
  const names = timeZoneChoices(WINTER, BERLIN).map((choice) => choice.timeZone);
  const runtime = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  expect(new Set(names)).toEqual(runtime);
  expect(names).toHaveLength(runtime.size);
});

const minutes = (offset: string) => {
  const [, sign, hours, mins] = /^UTC([+-])(\d+)(?::(\d+))?$/.exec(offset) ?? [];
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(mins ?? 0));
};
const orderKeys = (choices: ReturnType<typeof timeZoneChoices>) =>
  choices.map((choice) => [minutes(choice.offset), choice.place] as const);
const sortedKeys = (keys: ReturnType<typeof orderKeys>) =>
  keys.toSorted((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));

test("the list is sorted by offset, then by place", () => {
  const choices = timeZoneChoices(WINTER, BERLIN);
  expect(orderKeys(choices)).toEqual(sortedKeys(orderKeys(choices)));
  const index = (name: string) => choices.findIndex((choice) => choice.timeZone === name);
  expect(index("America/Los_Angeles")).toBeLessThan(index("UTC"));
  expect(index("UTC")).toBeLessThan(index("Europe/Berlin"));
  expect(index("Europe/Berlin")).toBeLessThan(index("Europe/Paris"));
});

test.each(["Asia/Kolkata", "Asia/Calcutta"])(
  "the shown zone %s stands in the list in its own spelling, in place of its other name",
  (name) => {
    const shown = zone(name);
    const choices = timeZoneChoices(WINTER, shown);
    expect(choiceOf(choices, name)).toEqual({
      timeZone: name,
      place: name.slice("Asia/".length),
      offset: "UTC+5:30",
    });
    expect(choices.filter((choice) => sameTimeZone(choice.timeZone, shown))).toHaveLength(1);
  },
);

test("a shown zone the runtime does not list is added at its place in the order", () => {
  const shown = zone("Etc/GMT+5");
  const choices = timeZoneChoices(WINTER, shown);
  expect(choiceOf(choices, "Etc/GMT+5")).toEqual({
    timeZone: "Etc/GMT+5",
    place: "GMT+5",
    offset: "UTC-5",
  });
  expect(orderKeys(choices)).toEqual(sortedKeys(orderKeys(choices)));
});

test("the places, without offsets, are what the settings search finds a zone by", () => {
  const places = timeZonePlaces();
  expect(places).toContain("Berlin");
  expect(places).toContain("Buenos Aires");
  expect(places).toContain("UTC");
});
