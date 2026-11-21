import { calendarDaySchema, resolveTimeZone, wallClockTimeSchema } from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import { describe, expect, test } from "vite-plus/test";
import { instantFrom, instantPartsOf } from "./instant-parts.ts";

const berlin = resolveTimeZone("Europe/Berlin").timeZone;
const day = (text: string) => calendarDaySchema.parse(text);
const time = (text: string) => wallClockTimeSchema.parse(text);
const at = (text: string) => requireInstant(text);

const parts = (date: string | null, clock: string | null) => ({
  day: date === null ? null : day(date),
  time: clock === null ? null : time(clock),
});

describe("a new Instant", () => {
  test("a date and a time give the Instant in the Time Zone", () => {
    expect(instantFrom(parts("2026-11-13", "09:00"), null, berlin, false)).toEqual({
      case: "set",
      instant: at("2026-11-13T08:00:00.000Z"),
    });
  });

  test("a part missing leaves it empty", () => {
    expect(instantFrom(parts("2026-11-13", null), null, berlin, false)).toEqual({
      case: "set",
      instant: null,
    });
    expect(instantFrom(parts(null, "09:00"), null, berlin, false)).toEqual({
      case: "set",
      instant: null,
    });
  });

  test("a time the clocks skip is no value (D347)", () => {
    expect(instantFrom(parts("2027-03-28", "02:30"), null, berlin, false)).toEqual({
      case: "skipped",
    });
  });
});

describe("a loaded Instant", () => {
  // Wednesday 09:47:13 in Berlin, as a timer's start carries seconds.
  const stored = at("2026-11-18T08:47:13.000Z");

  test("its parts are the date and the time it shows in the Time Zone", () => {
    expect(instantPartsOf(stored, berlin)).toEqual(parts("2026-11-18", "09:47"));
    expect(instantPartsOf(null, berlin)).toEqual(parts(null, null));
  });

  test("unchanged parts keep it with its seconds (D344)", () => {
    expect(instantFrom(parts("2026-11-18", "09:47"), stored, berlin, true)).toEqual({
      case: "keep",
    });
  });

  test("a changed date moves it there with its seconds (D344)", () => {
    expect(instantFrom(parts("2026-11-17", "09:47"), stored, berlin, true)).toEqual({
      case: "set",
      instant: at("2026-11-17T08:47:13.000Z"),
    });
  });

  test("a changed time takes the whole minute", () => {
    expect(instantFrom(parts("2026-11-18", "08:30"), stored, berlin, true)).toEqual({
      case: "set",
      instant: at("2026-11-18T07:30:00.000Z"),
    });
  });

  test("a value passing while a time is typed comes back with its seconds", () => {
    const passing = at("2026-11-18T07:47:00.000Z");
    expect(instantFrom(parts("2026-11-18", "09:47"), passing, berlin, true, stored)).toEqual({
      case: "set",
      instant: stored,
    });
  });
});
