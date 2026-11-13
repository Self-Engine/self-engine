import { describe, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { idSchema } from "@self-engine/db/schema";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import { newId, type IdSources } from "./index.ts";

const ZEROS = () => new Uint8Array(16);
const ONES = () => new Uint8Array(16).fill(0xff);

describe("newId", () => {
  test("returns the requested entity brand without changing the generated id", () => {
    const projectId = idSchema("Project");
    type ProjectId = z.output<typeof projectId>;
    const id = newId<ProjectId>({
      clock: fixedClock(requireInstant("2026-11-09T14:07:46.297Z")),
      random: ZEROS,
    });
    expectTypeOf(id).toEqualTypeOf<ProjectId>();
    expect(id).toBe("01a1c0a2-f079-7000-8000-000000000000");
    expect(projectId.parse(id)).toBe(id);
  });
  test("is a UUIDv7 made of the supplied clock and random source", () => {
    const id = newId({
      clock: fixedClock(requireInstant("2026-11-09T14:07:46.297Z")),
      random: ZEROS,
    });

    expect(id).toBe("01a1c0a2-f079-7000-8000-000000000000");
  });

  test("sorts by the time of creation, whatever the random part", () => {
    const earlier = newId({
      clock: fixedClock(requireInstant("2026-11-09T14:07:46.297Z")),
      random: ONES,
    });
    const later = newId({
      clock: fixedClock(requireInstant("2026-11-09T14:07:46.298Z")),
      random: ZEROS,
    });

    expect(earlier < later).toBe(true);
  });
});

test("id creation requires explicit clock sources", () => {
  expectTypeOf(newId).parameters.toEqualTypeOf<[IdSources]>();
});
