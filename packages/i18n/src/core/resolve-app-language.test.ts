import { describe, expect, test } from "vite-plus/test";
import { resolveAppLanguage } from "./index.ts";

describe("resolveAppLanguage", () => {
  test("an offered chosen language wins over the system", () => {
    expect(resolveAppLanguage("de", ["en-US"])).toBe("de");
  });

  test.each([undefined, null, "", "system", "fr", "constructor"])(
    "the chosen value %j counts as no choice",
    (chosen) => {
      expect(resolveAppLanguage(chosen, ["de-DE"])).toBe("de");
    },
  );

  test("the first offered system language wins", () => {
    expect(resolveAppLanguage(undefined, ["fr-FR", "de", "en"])).toBe("de");
  });

  test.each(["de-AT", "de_CH", "DE"])("the regional or cased tag %s means German", (tag) => {
    expect(resolveAppLanguage(undefined, [tag])).toBe("de");
    expect(resolveAppLanguage(tag, ["en"])).toBe("de");
  });

  test("a system without an offered language gets the Base Language", () => {
    expect(resolveAppLanguage(undefined, ["fr-FR", "ja"])).toBe("en");
  });

  test("no system languages at all give the Base Language", () => {
    expect(resolveAppLanguage(undefined, [])).toBe("en");
  });
});
