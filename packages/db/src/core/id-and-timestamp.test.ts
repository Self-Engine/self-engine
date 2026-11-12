import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from "vite-plus/test";
import { instantSchema, type Instant } from "@self-engine/time";
import { newId, newTimestamp } from "./index.ts";

describe("newTimestamp", () => {
  test.each([
    ["2026-11-09T14:07:46.297Z", "2026-11-09T14:07:46.297Z"],
    ["a time whose milliseconds are zero", "2026-11-09T14:07:46.000Z"],
    ["a time whose whole minute is zero", "2026-11-09T14:00:00.000Z"],
  ])("writes %s in the one exact format", (_name, expected) => {
    const timestamp = newTimestamp(() => new Date(Date.parse(expected)));
    expect(timestamp).toBe(expected);
    expectTypeOf(timestamp).toEqualTypeOf<Instant>();
    expect(instantSchema.parse(timestamp)).toBe(timestamp);
  });

  test("writes UTC for a time given with another offset", () => {
    expect(newTimestamp(() => new Date("2026-11-09T21:07:46.297+07:00"))).toBe(
      "2026-11-09T14:07:46.297Z",
    );
  });

  test.each([
    ["after the year 9999", "+010000-01-01T00:00:00.000Z"],
    ["before the year 1000", "0999-12-31T23:59:59.999Z"],
    ["before the year 0", "-000001-12-31T23:59:59.999Z"],
  ])("refuses a time %s, which has no place in the format", (_name, iso) => {
    expect(() => newTimestamp(() => new Date(iso))).toThrow(iso);
  });
});

const ZEROS = () => new Uint8Array(16);
const ONES = () => new Uint8Array(16).fill(0xff);

describe("newId", () => {
  test("is a UUIDv7 made of the supplied clock and random source", () => {
    const id = newId({ clock: () => new Date("2026-11-09T14:07:46.297Z"), random: ZEROS });

    expect(id).toBe("01a1c0a2-f079-7000-8000-000000000000");
  });

  test("sorts by the time of creation, whatever the random part", () => {
    const earlier = newId({ clock: () => new Date("2026-11-09T14:07:46.297Z"), random: ONES });
    const later = newId({ clock: () => new Date("2026-11-09T14:07:46.298Z"), random: ZEROS });

    expect(earlier < later).toBe(true);
  });

  describe("without supplied sources", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date("2026-11-09T14:07:46.297Z") });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("carries the current time", () => {
      expect(newId().startsWith("01a1c0a2-f079-7")).toBe(true);
    });

    test("stays in creation order within one millisecond", () => {
      const ids = Array.from({ length: 200 }, () => newId());

      expect(ids.toSorted()).toEqual(ids);
      expect(new Set(ids).size).toBe(200);
    });
  });
});
