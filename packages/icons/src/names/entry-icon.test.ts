import { z } from "zod";
import { describe, expect, it } from "vite-plus/test";
import { entryIconSchema, resolveEntryIcon } from "./index.ts";

const VALID: readonly (readonly [string, string])[] = [
  ["a known name", "piggy-bank"],
  ["a plain emoji", "🚀"],
  ["a flag", "🇧🇷"],
  ["a keycap", "7️⃣"],
  ["an emoji with a skin tone", "👋🏾"],
  ["a joined family", "👩‍👩‍👦"],
];

const INVALID: readonly (readonly [string, unknown])[] = [
  ["an unknown name", "rocket"],
  ["an old name", "savings"],
  ["two emoji", "🚀🚀"],
  ["a letter", "x"],
  ["a digit", "7"],
  ["a word", "Rocket launch"],
  ["an empty text", ""],
  ["a text symbol without its emoji form", "©"],
  ["no text", 7],
];

describe("entryIconSchema", () => {
  it.each(VALID)("accepts %s", (_, value) => {
    expect(entryIconSchema.safeParse(value)).toEqual({ success: true, data: value });
  });

  it.each(INVALID)("rejects %s", (_, value) => {
    expect(entryIconSchema.safeParse(value).success).toBe(false);
  });

  it("serves as a field of an Operation's input written with Zod's full build", () => {
    const input = z.object({ icon: z.optional(entryIconSchema) });
    expect(input.parse({ icon: "house" })).toEqual({ icon: "house" });
    expect(input.parse({})).toEqual({});
    expect(input.safeParse({ icon: "home" }).success).toBe(false);
  });
});

describe("resolveEntryIcon", () => {
  it("resolves a known name to its icon", () => {
    expect(resolveEntryIcon("piggy-bank")).toEqual({ kind: "icon", name: "piggy-bank" });
  });

  it("resolves exactly one emoji to that emoji", () => {
    expect(resolveEntryIcon("👩‍👩‍👦")).toEqual({ kind: "emoji", emoji: "👩‍👩‍👦" });
  });

  const NOTHING: readonly (readonly [string, string | null | undefined])[] = [
    ["no value", null],
    ["an absent value", undefined],
    ...INVALID.flatMap(([label, value]) =>
      typeof value === "string" ? [[label, value] as const] : [],
    ),
  ];

  it.each(NOTHING)("resolves %s to nothing", (_, value) => {
    expect(resolveEntryIcon(value)).toEqual({ kind: "none" });
  });

  it("never throws, whatever the store holds", () => {
    for (const value of ["\uD800", "🚀".repeat(10_000), "\u0000", " house ", "HOUSE"]) {
      expect(resolveEntryIcon(value)).toEqual({ kind: "none" });
    }
  });
});
