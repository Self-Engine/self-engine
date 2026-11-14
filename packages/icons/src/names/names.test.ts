import { describe, expect, it } from "vite-plus/test";
import { ICON_NAMES, isIconName } from "./index.ts";

describe("ICON_NAMES", () => {
  it("holds one name for each of the 107 pictures of the old app", () => {
    expect(ICON_NAMES).toHaveLength(107);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it("spells every name in lower case, digits and single hyphens", () => {
    for (const name of ICON_NAMES) expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("names a picture by what it shows", () => {
    for (const name of ["house", "briefcase", "barbell", "piggy-bank", "x-circle"]) {
      expect(isIconName(name)).toBe(true);
    }
    for (const name of ["fitness", "gym", "savings", "rent", "House", "", "x circle"]) {
      expect(isIconName(name)).toBe(false);
    }
  });
});
