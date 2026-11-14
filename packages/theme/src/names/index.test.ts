import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { COLOR_SETS } from "../core/index.ts";
import {
  COLOR_SET_NAMES,
  type ColorSetName,
  colorSetNameSchema,
  resolveColorSetName,
} from "./index.ts";

const TWELVE = [
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
];

describe("the Color Set names", () => {
  it("are the twelve color names of the old app, around the color wheel from red", () => {
    expect(COLOR_SET_NAMES).toEqual(TWELVE);
  });

  it("name exactly the Color Sets of the catalog", () => {
    expect(Object.keys(COLOR_SETS).toSorted()).toEqual(TWELVE.toSorted());
    expectTypeOf<keyof typeof COLOR_SETS>().toEqualTypeOf<ColorSetName>();
  });
});

describe("the Color Set name schema", () => {
  it.each(TWELVE)("accepts %s", (name) => {
    expect(colorSetNameSchema.parse(name)).toBe(name);
  });

  it.each(["gray", "", "#c92a2a", "RED", "Yellow", " red", "constructor", null, undefined, 3])(
    "rejects %j",
    (value) => {
      expect(colorSetNameSchema.safeParse(value).success).toBe(false);
    },
  );

  it("types a parsed value as a Color Set name", () => {
    expectTypeOf(colorSetNameSchema.parse("red")).toEqualTypeOf<ColorSetName>();
  });
});

describe("resolveColorSetName", () => {
  it.each(TWELVE)("resolves the stored %s to its Color Set", (name) => {
    expect(resolveColorSetName(name)).toBe(name);
  });

  it.each([
    ["an empty text", ""],
    ["nothing", null],
    ["no value", undefined],
    ["gray", "gray"],
    ["an unknown name", "turquoise"],
    ["a name in upper case", "RED"],
    ["a hex value", "#c92a2a"],
    ["an inherited property", "constructor"],
    ["another inherited property", "__proto__"],
  ])("answers nothing for %s", (_case, value) => {
    expect(resolveColorSetName(value)).toBeUndefined();
  });

  it("types its answer as a Color Set name or nothing", () => {
    expectTypeOf(resolveColorSetName).returns.toEqualTypeOf<ColorSetName | undefined>();
  });
});
