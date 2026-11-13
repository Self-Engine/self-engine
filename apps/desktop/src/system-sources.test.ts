import { systemClock } from "@self-engine/time/system-clock";
import { expect, test } from "vite-plus/test";
import { systemSources } from "./system-sources.ts";

test("the app's clock and the clock of its ids are both the system clock", () => {
  const { clock, ids } = systemSources();
  expect(clock).toBe(systemClock);
  expect(ids.clock).toBe(systemClock);
});

test("the random source yields 16 fresh bytes on every call", () => {
  const { random } = systemSources().ids;
  const first = random();
  expect(first).toBeInstanceOf(Uint8Array);
  expect(first).toHaveLength(16);
  expect(random()).not.toEqual(first);
});
