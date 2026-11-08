// The Start Cache end to end: real engine output is serialized, and the inline script from the
// real index.html applies it to a simulated document and storage.

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  type Appearance,
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  serializeStartCache,
  START_CACHE_KEY,
  START_STYLE_ID,
} from "@self-engine/theme";
import { describe, expect, it } from "vite-plus/test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const startScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

interface Scenario {
  readonly prefersDark?: boolean;
  /** Stored under the Start Cache key; absent means nothing is stored. */
  readonly stored?: string;
  readonly storage?: () => { getItem(key: string): string | null };
}

function runStartScript({ prefersDark = false, stored, storage }: Scenario) {
  const root = {
    attributes: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
  };
  const appended: { id?: string; textContent?: string }[] = [];
  const context = {
    document: {
      documentElement: root,
      head: { appendChild: (element: (typeof appended)[number]) => appended.push(element) },
      createElement: () => ({}),
    },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
    }),
    get localStorage() {
      if (storage !== undefined) return storage();
      return {
        getItem: (key: string) => (key === START_CACHE_KEY ? (stored ?? null) : null),
      };
    },
  };
  runInNewContext(startScript, context);
  const style = appended.find((element) => element.id === START_STYLE_ID);
  return {
    scheme: root.attributes["data-mantine-color-scheme"],
    density: root.dataset.density,
    fontSize: root.style.fontSize,
    css: style?.textContent ?? "",
  };
}

function cacheOf(settings: Partial<Appearance>) {
  const appearance = { ...DEFAULT_APPEARANCE, ...settings };
  const resolved = resolveAppearance(appearance, BUILT_IN_THEMES);
  return { resolved, stored: serializeStartCache(appearance.colorMode, resolved) };
}

function expectFinalValues(css: string, mode: ReturnType<typeof cacheOf>["resolved"]["dark"]) {
  const variables = { ...mode.cssVariables, ...mode.mantineVariables };
  for (const [name, value] of Object.entries<string>(variables)) {
    expect(css).toContain(`${name}:${value};`);
  }
  expect(css).toContain(`background:${mode.roles.canvas};`);
}

describe("the start script with a usable cache", () => {
  it("applies the dark values, Density and font scale when the Color Mode is dark", () => {
    const { resolved, stored } = cacheOf({
      colorMode: "dark",
      darkTheme: "warm",
      density: "compact",
      fontScale: 112.5,
    });

    const result = runStartScript({ stored, prefersDark: false });

    expect(result.scheme).toBe("dark");
    expect(result.density).toBe("compact");
    expect(result.fontSize).toBe("112.5%");
    expect(result.css).toContain("color-scheme:dark;");
    expectFinalValues(result.css, resolved.dark);
  });

  it("applies the light values when the Color Mode is light, even on a dark system", () => {
    const { resolved, stored } = cacheOf({ colorMode: "light", lightTheme: "cool" });

    const result = runStartScript({ stored, prefersDark: true });

    expect(result.scheme).toBe("light");
    expect(result.css).toContain("color-scheme:light;");
    expectFinalValues(result.css, resolved.light);
  });

  it.each([
    ["dark", true],
    ["light", false],
  ] as const)("follows a %s system when the Color Mode is system", (mode, prefersDark) => {
    const { resolved, stored } = cacheOf({ colorMode: "system" });

    const result = runStartScript({ stored, prefersDark });

    expect(result.scheme).toBe(mode);
    expectFinalValues(result.css, resolved[mode]);
  });

  it("opens dark when the system switched to dark after the cache was written", () => {
    // The cache holds both Color Modes, so it needs no rewrite for the changed preference.
    const { resolved, stored } = cacheOf({ colorMode: "system" });

    expect(runStartScript({ stored, prefersDark: false }).scheme).toBe("light");
    const reopened = runStartScript({ stored, prefersDark: true });

    expect(reopened.scheme).toBe("dark");
    expectFinalValues(reopened.css, resolved.dark);
  });
});

describe("the start script without a usable cache", () => {
  const { stored: valid } = cacheOf({ colorMode: "dark" });
  const parsedValid = JSON.parse(valid) as Record<string, unknown>;
  const changed = (fields: Record<string, unknown>) =>
    JSON.stringify({ ...parsedValid, ...fields });

  const scenarios: readonly (readonly [string, Scenario])[] = [
    ["nothing stored", {}],
    ["text that is not JSON", { stored: "{not json" }],
    ["a stored null", { stored: "null" }],
    ["a stored number", { stored: "5" }],
    ["an empty object", { stored: "{}" }],
    ["another cache version", { stored: changed({ version: 2 }) }],
    ["an unknown Color Mode", { stored: changed({ colorMode: "sepia" }) }],
    ["an inherited property as Color Mode", { stored: changed({ colorMode: "constructor" }) }],
    ["no css for the Color Mode", { stored: changed({ css: { light: "x" } }) }],
    ["css that is not text", { stored: changed({ css: { dark: 5, light: 5 } }) }],
    ["a Density that is not text", { stored: changed({ density: 5 }) }],
    ["a font size that is not text", { stored: changed({ rootFontSize: null }) }],
    [
      "a storage that throws on read",
      {
        storage: () => ({
          getItem: () => {
            throw new Error("denied");
          },
        }),
      },
    ],
    [
      "a storage that throws on access",
      {
        storage: () => {
          throw new Error("SecurityError");
        },
      },
    ],
  ];

  describe.each(scenarios)("%s", (_name, scenario) => {
    it.each([
      ["dark", true],
      ["light", false],
    ] as const)("uses the neutral default of a %s system", (mode, prefersDark) => {
      const result = runStartScript({ ...scenario, prefersDark });

      expect(result.scheme).toBe(mode);
      expect(result.css).toBe(`html{color-scheme:${mode}}`);
      expect(result.density).toBeUndefined();
      expect(result.fontSize).toBeUndefined();
    });
  });
});

describe("the start script in the page", () => {
  it("runs in the head, before the app's module", () => {
    expect(startScript).not.toBe("");
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("</head>"));
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('type="module"'));
  });

  it("uses the engine's storage key and style id", () => {
    expect(startScript).toContain(JSON.stringify(START_CACHE_KEY));
    expect(startScript).toContain(JSON.stringify(START_STYLE_ID));
  });

  it("contains no Theme logic: no color value, variable or role name", () => {
    expect(startScript).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|--se-|--mantine-/i);
    for (const role of Object.keys(
      resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES).light.roles,
    )) {
      expect(startScript).not.toMatch(new RegExp(`\\b${role}\\b`));
    }
  });
});
