import { describe, expect, it } from "vite-plus/test";
import {
  auditContrast,
  BUILT_IN_THEMES,
  contrastRatio,
  formatContrastFailure,
  type Theme,
  type ThemeColors,
} from "./index.ts";

const neutral = BUILT_IN_THEMES["neutral"] as Theme;
const lightTable = neutral.colors.light as ThemeColors;

/** The catalog holding one light Theme with its Neutral values changed by `overrides`. */
function catalogWith(overrides: Partial<ThemeColors>) {
  const colors = { light: { ...lightTable, ...overrides } };
  return { probe: { version: 1, id: "probe", name: "Probe", colors } } as const;
}

function pairs(overrides: Partial<ThemeColors>): string[] {
  return [...new Set(auditContrast(catalogWith(overrides)).map((failure) => failure.pair))];
}

describe("contrastRatio", () => {
  it("matches known WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#ffffff", "#000000")).toBe(21);
    // A commonly cited border case: #767676 on white just passes, #777777 just fails.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("auditContrast on the built-in catalog", () => {
  it("finds no failure", () => {
    expect(auditContrast(BUILT_IN_THEMES).map(formatContrastFailure)).toEqual([]);
  });
});

describe("a failure", () => {
  it("names the Theme, Color Mode, Accent, Background Tint state, pair and ratio", () => {
    const [failure] = auditContrast(catalogWith({ textMuted: "#ffffff" }));
    expect(failure).toBeDefined();
    const message = formatContrastFailure(failure as NonNullable<typeof failure>);
    expect(message).toContain("probe");
    expect(message).toContain("light");
    expect(message).toContain("blue");
    expect(message).toMatch(/tint (on|off)/);
    expect(message).toContain("textMuted on chrome");
    expect(message).toMatch(/1\.\d\d:1/);
    expect(message).toContain("4.5:1");
  });

  it("reports every combination of the Background Tint", () => {
    const states = auditContrast(catalogWith({ text: "#ffffff" }))
      .filter((failure) => failure.pair === "text on canvas")
      .map((failure) => failure.backgroundTint);
    expect(states).toEqual([true, false]);
  });
});

describe("the pairs that are checked", () => {
  it("checks text on hover over each surface other than chrome", () => {
    // Passes on every plain surface, fails only once the overlay darkens it.
    const failing = pairs({ hover: "#18181bcc" }).filter((pair) => pair.startsWith("text on"));
    expect(failing).toEqual([
      "text on hover over navSurface",
      "text on hover over canvas",
      "text on hover over surface",
      "text on hover over surfaceRaised",
    ]);
  });

  it("requires hover to be visible on each surface other than chrome", () => {
    expect(pairs({ hover: "#18181b01" })).toEqual([
      "hover against navSurface",
      "hover against canvas",
      "hover against surface",
      "hover against surfaceRaised",
    ]);
  });

  it("checks borderControl at 3:1 and leaves the decorative border alone", () => {
    expect(pairs({ border: "#ffffff" })).toEqual([]);
    expect(pairs({ borderControl: "#c8c8cc" })).toContain("borderControl on canvas");
  });

  it("checks status text on the surfaces and its own soft fill", () => {
    const failing = pairs({ errorText: "#ff9999" });
    expect(failing).toContain("errorText on canvas");
    expect(failing).toContain("errorText on errorSoft");
    expect(failing).not.toContain("errorText on chrome");
  });

  it("checks text on its own fill", () => {
    expect(pairs({ onSuccess: "#22aa55" })).toEqual(["onSuccess on success"]);
  });

  it("checks text on every soft fill", () => {
    expect(pairs({ warningSoft: "#000000" })).toContain("text on warningSoft");
  });
});
