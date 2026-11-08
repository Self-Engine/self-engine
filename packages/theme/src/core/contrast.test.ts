import { describe, expect, it } from "vite-plus/test";
import {
  ACCENT_IDS,
  type ColorSetColors,
  auditColorSets,
  auditContrast,
  BUILT_IN_THEMES,
  checkContrast,
  COLOR_SETS,
  type ColorSet,
  contrastRatio,
  DEFAULT_APPEARANCE,
  formatColorSetFailure,
  formatContrastFailure,
  FROM_THEME,
  type ModuleColor,
  resolveAppearance,
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

function pairsFromTheme(accent: ColorSetColors): string[] {
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

  it("covers all 72 combinations of Theme, Color Mode, Accent and Background Tint", () => {
    // Text in the color of the canvas fails in every combination, so each one reports it.
    const unreadable = (table: ThemeColors): ThemeColors => ({ ...table, text: table.canvas });
    const catalog = Object.fromEntries(
      Object.values(BUILT_IN_THEMES).map((theme) => [
        theme.id,
        {
          ...theme,
          colors: {
            light: unreadable(theme.colors.light as ThemeColors),
            dark: unreadable(theme.colors.dark as ThemeColors),
          },
        },
      ]),
    );
    const combinations = auditContrast(catalog)
      .filter((failure) => failure.pair === "text on canvas")
      .map((failure) =>
        [failure.theme, failure.colorMode, failure.accent, failure.backgroundTint].join(" "),
      );
    expect(combinations).toHaveLength(72);
    expect(new Set(combinations).size).toBe(72);
  });
});

describe("the final tinted surfaces", () => {
  // Each value reads on the untinted surface with blue and misses 4.5:1 once it is tinted.
  it.each([
    ["text", "chrome", "#6e6e76"],
    ["textMuted", "chrome", "#6e6e76"],
    ["text", "navSurface", "#74747c"],
    ["textMuted", "navSurface", "#74747c"],
    ["errorText", "navSurface", "#74747c"],
  ] as const)("reports %s on %s only with the Background Tint on", (role, surface, value) => {
    const states = auditContrast(catalogWith({ [role]: value }))
      .filter((failure) => failure.pair === `${role} on ${surface}` && failure.accent === "blue")
      .map((failure) => failure.backgroundTint);
    expect(states).toEqual([true]);
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

describe("Module Color text", () => {
  const moduleTextPairs = (overrides: Partial<ThemeColors>, colorSet: string) =>
    pairs(overrides).filter((pair) => pair.startsWith(`${colorSet} module text`));

  it("is checked on canvas", () => {
    expect(moduleTextPairs({ canvas: "#808080" }, "teal")).toEqual(["teal module text on canvas"]);
  });

  it("is checked on the calculated navSurface, which a light surface over a dark chrome dims", () => {
    expect(moduleTextPairs({ chrome: "#000000", surface: "#ffffff" }, "teal")).toEqual([
      "teal module text on navSurface",
    ]);
  });

  it("is checked on surface, for all eight Color Sets, green and pink included", () => {
    const overrides = { chrome: "#808080", surface: "#808080" } as const;
    for (const colorSet of Object.keys(COLOR_SETS)) {
      expect(moduleTextPairs(overrides, colorSet)).toEqual([
        `${colorSet} module text on navSurface`,
        `${colorSet} module text on surface`,
      ]);
    }
  });

  it("is checked on its own soft fill", () => {
    const { light } = resolveAppearance(
      { ...DEFAULT_APPEARANCE, colorMode: "light" },
      BUILT_IN_THEMES,
    );
    const teal = light.moduleColors["teal"] as ModuleColor;
    const issues = checkContrast({
      roles: light.roles,
      moduleColors: { probe: { ...teal, "--se-module-soft": teal["--se-module-text"] } },
    });
    expect(issues.map((issue) => issue.pair)).toEqual(["probe module text on its soft fill"]);
  });
});
