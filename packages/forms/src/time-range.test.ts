import {
  calendarDaySchema,
  type Instant,
  resolveTimeZone,
  wallClockTimeSchema,
} from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import { describe, expect, test } from "vite-plus/test";
import { isNextDay, partsOf, type RangeParts, rangeFrom } from "./time-range.ts";

const berlin = resolveTimeZone("Europe/Berlin").timeZone;
const day = (text: string) => calendarDaySchema.parse(text);
const time = (text: string) => wallClockTimeSchema.parse(text);
const at = (text: string) => requireInstant(text);

function parts(
  date: string | null,
  start: string | null,
  end: string | null,
  endDay: string | null = null,
): RangeParts {
  return {
    day: date === null ? null : day(date),
    startTime: start === null ? null : time(start),
    endTime: end === null ? null : time(end),
    endDayOpen: endDay !== null,
    endDay: endDay === null ? null : day(endDay),
  };
}

const none = { start: null, end: null } as const;

describe("a new range", () => {
  test("a date, a start and an end give two Instants in the Time Zone", () => {
    expect(rangeFrom(parts("2026-11-13", "09:00", "17:30"), none, berlin, false)).toEqual({
      start: { case: "set", instant: at("2026-11-13T08:00:00.000Z") },
      end: { case: "set", instant: at("2026-11-13T16:30:00.000Z") },
    });
  });

  test("an end not after the start lies on the next day", () => {
    const night = parts("2026-11-13", "22:00", "01:30");
    expect(isNextDay(night)).toBe(true);
    expect(rangeFrom(night, none, berlin, false).end).toEqual({
      case: "set",
      instant: at("2026-11-14T00:30:00.000Z"),
    });
    // An end equal to the start is a whole day later.
    expect(rangeFrom(parts("2026-11-13", "09:00", "09:00"), none, berlin, false).end).toEqual({
      case: "set",
      instant: at("2026-11-14T08:00:00.000Z"),
    });
  });

  test("an opened end date carries the end, and no next day is counted", () => {
    const days = parts("2026-11-13", "22:00", "01:30", "2026-11-15");
    expect(isNextDay(days)).toBe(false);
    expect(rangeFrom(days, none, berlin, false).end).toEqual({
      case: "set",
      instant: at("2026-11-15T00:30:00.000Z"),
    });
  });

  test("an opened end date left empty leaves the end empty", () => {
    const opened = { ...parts("2026-11-13", "09:00", "17:30"), endDayOpen: true };
    expect(rangeFrom(opened, none, berlin, false).end).toEqual({ case: "set", instant: null });
  });

  test("a part missing leaves its Instant empty", () => {
    expect(rangeFrom(parts("2026-11-13", null, "17:30"), none, berlin, false)).toEqual({
      start: { case: "set", instant: null },
      end: { case: "set", instant: at("2026-11-13T16:30:00.000Z") },
    });
    expect(rangeFrom(parts(null, "09:00", "17:30"), none, berlin, false)).toEqual({
      start: { case: "set", instant: null },
      end: { case: "set", instant: null },
    });
  });

  // D347, Berlin, 25 October 2026: 02:00–02:59 shows twice.
  test("a new range from 01:30 to 02:30 is one hour long", () => {
    expect(rangeFrom(parts("2026-10-25", "01:30", "02:30"), none, berlin, false)).toEqual({
      start: { case: "set", instant: at("2026-10-24T23:30:00.000Z") },
      end: { case: "set", instant: at("2026-10-25T00:30:00.000Z") },
    });
  });

  test("from 01:00 to 04:00 is four hours on 25 October 2026 and two on 28 March 2027", () => {
    expect(rangeFrom(parts("2026-10-25", "01:00", "04:00"), none, berlin, false)).toEqual({
      start: { case: "set", instant: at("2026-10-24T23:00:00.000Z") },
      end: { case: "set", instant: at("2026-10-25T03:00:00.000Z") },
    });
    expect(rangeFrom(parts("2027-03-28", "01:00", "04:00"), none, berlin, false)).toEqual({
      start: { case: "set", instant: at("2027-03-28T00:00:00.000Z") },
      end: { case: "set", instant: at("2027-03-28T02:00:00.000Z") },
    });
  });

  test("a skipped time is no value", () => {
    expect(rangeFrom(parts("2027-03-28", "02:30", "04:00"), none, berlin, false)).toEqual({
      start: { case: "skipped" },
      end: { case: "set", instant: at("2027-03-28T02:00:00.000Z") },
    });
    expect(rangeFrom(parts("2027-03-28", "01:00", "02:15"), none, berlin, false).end).toEqual({
      case: "skipped",
    });
  });
});

describe("a loaded range", () => {
  const loaded = {
    start: at("2026-11-13T08:00:50.000Z"),
    end: at("2026-11-13T16:30:10.000Z"),
  } satisfies Record<string, Instant>;

  test("its parts are what the two Instants show in the Time Zone", () => {
    expect(partsOf(loaded.start, loaded.end, berlin)).toEqual(
      parts("2026-11-13", "09:00", "17:30"),
    );
  });

  test("unchanged parts keep both Instants with their seconds", () => {
    expect(rangeFrom(parts("2026-11-13", "09:00", "17:30"), loaded, berlin, true)).toEqual({
      start: { case: "keep" },
      end: { case: "keep" },
    });
  });

  test("a changed start leaves the end with its seconds, and the other way round", () => {
    expect(rangeFrom(parts("2026-11-13", "09:30", "17:30"), loaded, berlin, true)).toEqual({
      start: { case: "set", instant: at("2026-11-13T08:30:00.000Z") },
      end: { case: "keep" },
    });
    expect(rangeFrom(parts("2026-11-13", "09:00", "18:00"), loaded, berlin, true)).toEqual({
      start: { case: "keep" },
      end: { case: "set", instant: at("2026-11-13T17:00:00.000Z") },
    });
  });

  test("a changed date moves both", () => {
    expect(rangeFrom(parts("2026-11-14", "09:00", "17:30"), loaded, berlin, true)).toEqual({
      start: { case: "set", instant: at("2026-11-14T08:00:00.000Z") },
      end: { case: "set", instant: at("2026-11-14T16:30:00.000Z") },
    });
  });

  test("a start moved past the end moves the end to the next day, as the field shows it", () => {
    expect(rangeFrom(parts("2026-11-13", "18:00", "17:30"), loaded, berlin, true)).toEqual({
      start: { case: "set", instant: at("2026-11-13T17:00:00.000Z") },
      end: { case: "set", instant: at("2026-11-14T16:30:00.000Z") },
    });
  });

  test("an end over the next day opens the end date; one on the next day shows +1", () => {
    const overTwoDays = partsOf(loaded.start, at("2026-11-15T16:30:00.000Z"), berlin);
    expect(overTwoDays).toEqual(parts("2026-11-13", "09:00", "17:30", "2026-11-15"));
    const overnight = partsOf(
      at("2026-11-13T21:00:00.000Z"),
      at("2026-11-14T00:30:00.000Z"),
      berlin,
    );
    expect(overnight).toEqual(parts("2026-11-13", "22:00", "01:30"));
    expect(isNextDay(overnight)).toBe(true);
    // Ends the field would read as another day keep their own end date.
    expect(partsOf(at("2026-11-13T08:00:50.000Z"), at("2026-11-13T08:00:59.000Z"), berlin)).toEqual(
      parts("2026-11-13", "09:00", "09:00", "2026-11-13"),
    );
  });

  test("a correction inside the repeated hour stays in the same hour (D347)", () => {
    // A timer stopped at the second 02:40 of 25 October 2026; the end is corrected to 02:45.
    const timer = { start: at("2026-10-25T00:10:00.000Z"), end: at("2026-10-25T01:40:30.000Z") };
    expect(partsOf(timer.start, timer.end, berlin)).toEqual(parts("2026-10-25", "02:10", "02:40"));
    expect(rangeFrom(parts("2026-10-25", "02:10", "02:45"), timer, berlin, true)).toEqual({
      start: { case: "keep" },
      end: { case: "set", instant: at("2026-10-25T01:45:00.000Z") },
    });
  });
});
