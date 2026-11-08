import { describe, expect, it } from "vite-plus/test";
import {
  ACCENT_IDS,
  type AccentColors,
  auditColorSets,
  auditContrast,
  BUILT_IN_THEMES,
  COLOR_SETS,
  type ColorSet,
  contrastRatio,
  formatColorSetFailure,
  formatContrastFailure,
  FROM_THEME,
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

function pairsFromTheme(accent: AccentColors): string[] {
  const theme = { ...catalogWith({}).probe, accent: { light: accent } };
  const failures = auditContrast({ probe: theme });
  return [
    ...new Set(
      failures.filter((failure) => failure.accent === FROM_THEME).map((failure) => failure.pair),
    ),
  ];
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

  it("covers every Accent", () => {
    const failures = auditContrast(catalogWith({ text: "#ffffff" }));
    expect([...new Set(failures.map((failure) => failure.accent))]).toEqual(ACCENT_IDS);
  });
});

describe("auditColorSets", () => {
  it("finds no failure in the eight Color Sets, in either Color Mode", () => {
    expect(auditColorSets(COLOR_SETS).map(formatColorSetFailure)).toEqual([]);
  });

  it("names the Color Set, Color Mode, pair and ratio", () => {
    const blue = COLOR_SETS["blue"] as ColorSet;
    const failing = { ...blue.light, accentSoft: "#1a5fc0" } as const;
    const [failure] = auditColorSets({ probe: { light: failing, dark: blue.dark } });
    expect(failure).toBeDefined();
    const message = formatColorSetFailure(failure as NonNullable<typeof failure>);
    expect(message).toMatch(/^probe light: accentText on accentSoft is 1\.00:1, needs 4\.5:1$/);
  });

  it("checks on-fill text on the fill and its calculated hover", () => {
    const blue = COLOR_SETS["blue"] as ColorSet;
    const failing = { ...blue.dark, onAccent: "#3f7fe0" } as const;
    const names = auditColorSets({ probe: { light: blue.light, dark: failing } }).map(
      (failure) => failure.pair,
    );
    expect(names).toEqual(["onAccent on accent", "onAccent on accent hover"]);
  });
});

describe("a Theme's own Accent", () => {
  const accent = { accent: "#1c6ed5", onAccent: "#1c6ed5", accentSoft: "#e7f0fc" } as const;

  it("is audited under From Theme", () => {
    const failures = auditContrast({
      probe: {
        version: 1,
        id: "probe",
        name: "Probe",
        colors: { light: lightTable },
        accent: { light: { ...accent, accentText: "#1a5fc0" } },
      },
    });
    expect(
      failures.filter((failure) => failure.accent === FROM_THEME).map((failure) => failure.pair),
    ).toContain("onAccent on accent hover");
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
      .filter((failure) => failure.pair === "text on canvas" && failure.accent === "blue")
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

  it("checks text on its own fill and the calculated fill hover", () => {
    expect(pairs({ onSuccess: "#22aa55" })).toEqual([
      "onSuccess on success",
      "onSuccess on success hover",
    ]);
  });

  it("checks the Accent's colored text on its calculated hover values", () => {
    const blue = COLOR_SETS["blue"] as ColorSet;
    const failing = pairsFromTheme({ ...blue.light, accentText: "#6f9ee0" });
    expect(failing).toContain("accentText on accentSoft hover");
    expect(failing).toContain("accentText on outline hover over canvas");
  });

  it("checks text on every soft fill", () => {
    expect(pairs({ warningSoft: "#000000" })).toContain("text on warningSoft");
  });
});
