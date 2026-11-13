import { afterEach, expect, expectTypeOf, test, vi } from "vite-plus/test";
import * as main from "./index.ts";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import { systemClock } from "@self-engine/time/system-clock";
import type { Clock, Instant } from "./index.ts";

afterEach(() => vi.useRealTimers());

test("a fixed clock returns the supplied Instant on every read", () => {
  const value = requireInstant("2026-11-14T07:30:27.297Z");
  const clock = fixedClock(value);
  expectTypeOf(clock).toEqualTypeOf<Clock>();
  expectTypeOf(clock()).toEqualTypeOf<Instant>();
  expect(clock()).toBe(value);
  expect(clock()).toBe(value);
  expectTypeOf(fixedClock).parameters.toEqualTypeOf<[Instant]>();
});
test.each(["2026-11-14T07:30:27Z", "0999-12-31T23:59:59.999Z", "2026-02-29T00:00:00.000Z"])(
  "fixture helper rejects noncanonical Instant %s",
  (text) => {
    expect(() => requireInstant(text)).toThrow();
  },
);
test("the main entry exposes neither clock implementation", () => {
  expect(main).not.toHaveProperty("systemClock");
  expect(main).not.toHaveProperty("fixedClock");
  expect(main).not.toHaveProperty("requireInstant");
});
test("the system clock reads controlled system time and retains milliseconds", () => {
  vi.useFakeTimers({ toFake: ["Date"], now: 1794614400297 });
  expect(systemClock()).toBe("2026-11-14T00:00:00.297Z");
  vi.setSystemTime(1794614400999);
  expect(systemClock()).toBe("2026-11-14T00:00:00.999Z");
  expectTypeOf(systemClock).toEqualTypeOf<Clock>();
});
