// Checks the Density values against the pinned Mantine, whose control heights exist only in CSS.
// A Mantine update that makes a control taller than a compact row fails here.

import { DEFAULT_THEME } from "@mantine/core";
import buttonCss from "@mantine/core/styles/Button.css?raw";
import inputCss from "@mantine/core/styles/Input.css?raw";
import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  DENSITY_VARIABLES,
  type Density,
  resolveAppearance,
} from "../core/index.ts";
import { mantineTheme } from "./theme.ts";

function heightInRem(css: string, variable: string): number {
  const match = new RegExp(
    `${variable}:\\s*calc\\(([\\d.]+)rem \\* var\\(--mantine-scale\\)\\)`,
  ).exec(css);
  if (match?.[1] === undefined) throw new Error(`Mantine's CSS no longer defines ${variable}`);
  return Number(match[1]);
}

const compactRow = Number.parseFloat(DENSITY_VARIABLES.compact["--se-row-height"]);

function componentsFor(density: Density) {
  const resolved = resolveAppearance({ ...DEFAULT_APPEARANCE, density }, BUILT_IN_THEMES);
  return mantineTheme(resolved, "light").components;
}

describe("Mantine's control sizes", () => {
  it("are left alone when comfortable", () => {
    expect(componentsFor("comfortable")).toEqual({});
  });

  it("default to xs for inputs and buttons when compact", () => {
    expect(componentsFor("compact")).toEqual({
      Input: { defaultProps: { size: "xs" } },
      Button: { defaultProps: { size: "xs" } },
    });
  });
});

describe("compact Density against the pinned Mantine", () => {
  it.each([
    ["Button", buttonCss, "--button-height-xs"],
    ["Input", inputCss, "--input-height-xs"],
  ])("fits a default %s inside a row", (component, css, variable) => {
    expect(componentsFor("compact")?.[component]?.defaultProps).toEqual({ size: "xs" });
    expect(heightInRem(css, variable)).toBeLessThanOrEqual(compactRow);
  });

  it.each([
    ["button", buttonCss, "--button-height-sm"],
    ["input", inputCss, "--input-height-sm"],
  ])(
    "needs the lower size: Mantine's default %s is taller than a row",
    (_control, css, variable) => {
      expect(heightInRem(css, variable)).toBeGreaterThan(compactRow);
    },
  );
});

describe("Mantine's type tokens", () => {
  it("keeps scale at 1, so that the root font size alone drives the font scale", () => {
    expect(DEFAULT_THEME.scale).toBe(1);
  });

  it("defines no font size in pixels", () => {
    const tokens = [
      ...Object.values(DEFAULT_THEME.fontSizes),
      ...Object.values(DEFAULT_THEME.headings.sizes).map(({ fontSize }) => fontSize),
    ];
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(token).toMatch(/rem/);
  });
});
