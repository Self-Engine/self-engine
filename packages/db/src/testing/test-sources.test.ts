import { expect, test } from "vite-plus/test";
import { newId, newTimestamp } from "../core/index.ts";
import { createTestSources } from "./index.ts";

test("time stays fixed until explicitly advanced", () => {
  const sources = createTestSources("2026-11-09T14:07:46.297Z");

  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
  sources.advance(1234);
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:47.531Z");
});

test("ids are unique and ascend within one millisecond, including counter carries", () => {
  const sources = createTestSources("2026-11-09T14:07:46.297Z");
  const ids = Array.from({ length: 1025 }, () => newId(sources.ids));

  expect(new Set(ids).size).toBe(1025);
  expect(ids.toSorted()).toEqual(ids);
  expect(ids.every((id) => id.startsWith("01a1c0a2-f079-7"))).toBe(true);
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.297Z");
});

test("ids and timestamps agree on the moment before and after advancing", () => {
  const sources = createTestSources("2026-11-09T14:07:46.297Z");
  const idTime = (id: string) =>
    Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16);

  expect(idTime(newId(sources.ids))).toBe(1794233266297);
  sources.advance(1);
  expect(idTime(newId(sources.ids))).toBe(1794233266298);
  expect(newTimestamp(sources.clock)).toBe("2026-11-09T14:07:46.298Z");
});

test("the same start reproduces the id sequence independently", () => {
  const first = createTestSources("2026-11-09T14:07:46.297Z");
  const second = createTestSources("2026-11-09T14:07:46.297Z");
  const sequence = (sources: ReturnType<typeof createTestSources>) => {
    const ids = Array.from({ length: 300 }, () => newId(sources.ids));
    sources.advance(25);
    return [...ids, newId(sources.ids)];
  };

  expect(sequence(first)).toEqual(sequence(second));
});

test("a read Instant stays fixed when the shared clock advances", () => {
  const sources = createTestSources("2026-11-09T14:07:46.297Z");
  const first = sources.clock();
  sources.advance(1);
  expect(first).toBe("2026-11-09T14:07:46.297Z");
  expect(sources.ids.clock()).toBe("2026-11-09T14:07:46.298Z");
});
