import { expect, test } from "vite-plus/test";
import { newId, newTimestamp } from "../core/index.ts";
import { createTestSources } from "./index.ts";

test("time stays fixed until explicitly advanced", () => {
  const sources = createTestSources(new Date("2026-11-09T14:07:46.297Z"));

  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
  sources.advance(1234);
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:47.531Z");
});

test("ids are unique and ascend within one millisecond, including counter carries", () => {
  const sources = createTestSources(new Date("2026-11-09T14:07:46.297Z"));
  const ids = Array.from({ length: 1025 }, () => newId(sources.ids));

  expect(new Set(ids).size).toBe(1025);
  expect(ids.toSorted()).toEqual(ids);
  expect(ids.every((id) => id.startsWith("01a1c0a2-f079-7"))).toBe(true);
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
});

test("ids and timestamps agree on the moment before and after advancing", () => {
  const sources = createTestSources(new Date("2026-11-09T14:07:46.297Z"));
  const idTime = (id: string) =>
    new Date(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toISOString();

  expect(idTime(newId(sources.ids))).toBe("2026-11-09T14:07:46.297Z");
  sources.advance(1);
  expect(idTime(newId(sources.ids))).toBe("2026-11-09T14:07:46.298Z");
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.298Z");
});

test("the same start reproduces the id sequence independently", () => {
  const first = createTestSources(new Date("2026-11-09T14:07:46.297Z"));
  const second = createTestSources(new Date("2026-11-09T14:07:46.297Z"));
  const sequence = (sources: ReturnType<typeof createTestSources>) => {
    const ids = Array.from({ length: 300 }, () => newId(sources.ids));
    sources.advance(25);
    return [...ids, newId(sources.ids)];
  };

  expect(sequence(first)).toEqual(sequence(second));
});

test("mutating supplied and returned dates cannot advance the shared time", () => {
  const start = new Date("2026-11-09T14:07:46.297Z");
  const sources = createTestSources(start);
  start.setTime(0);
  sources.clock().setTime(0);
  sources.ids.clock().setTime(0);

  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
});
