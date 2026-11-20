import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import { instantSchema } from "./instant.ts";
import { calendarDayFrom, instantFrom } from "./supported-years.ts";
import { calendarDaySchema } from "./values.ts";

// 1000-01-01T00:00:00.000Z to 9999-12-31T23:59:59.999Z.
const FIRST_MS = -30_610_224_000_000;
const LAST_MS = 253_402_300_799_999;

test("an Instant built without the schemas passes the Instant schema in every supported year", () => {
  fc.assert(
    fc.property(fc.integer({ min: FIRST_MS, max: LAST_MS }), fc.nat(999_999), (ms, ns) => {
      const exact = Temporal.Instant.fromEpochNanoseconds(BigInt(ms) * 1_000_000n + BigInt(ns));
      const instant = instantFrom(exact);
      expect(instantSchema.parse(instant)).toBe(instant);
      // Cut to the millisecond, never rounded up.
      expect(Temporal.Instant.from(instant).epochMilliseconds).toBe(ms);
    }),
  );
});

test.each([FIRST_MS - 1, LAST_MS + 1])(
  "an Instant at %s ms is outside the supported years",
  (ms) => {
    expect(() => instantFrom(Temporal.Instant.fromEpochMilliseconds(ms))).toThrow(RangeError);
  },
);

test("a calendar day built without the schemas passes the day schema in every supported year", () => {
  const first = Temporal.PlainDate.from("1000-01-01");
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3_287_181 }), (days) => {
      const day = calendarDayFrom(first.add({ days }));
      expect(calendarDaySchema.parse(day)).toBe(day);
    }),
  );
  expect(calendarDayFrom(first.add({ days: 3_287_181 }))).toBe("9999-12-31");
});

test.each(["0999-12-31", "+010000-01-01"])("the day %s is outside the supported years", (text) => {
  expect(() => calendarDayFrom(Temporal.PlainDate.from(text))).toThrow(RangeError);
});
