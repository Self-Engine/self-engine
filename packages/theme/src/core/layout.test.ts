import { describe, expect, it } from "vite-plus/test";
import {
  type Appearance,
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
} from "./index.ts";

function layoutOf(settings: Partial<Appearance>) {
  return resolveAppearance({ ...DEFAULT_APPEARANCE, ...settings }, BUILT_IN_THEMES).layout;
}

describe("Density", () => {
  it("is comfortable by default and marks the root element with it", () => {
    const { layout } = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);
    expect(DEFAULT_APPEARANCE.density).toBe("comfortable");
    expect(layout.density).toBe("comfortable");
  });

  it("sets row height, padding and gap under the data-density attribute, grown by the font scale", () => {
    const { densityCss } = layoutOf({});
    // 44/16/4 px and 34/12/2 px at the 100 % font scale.
    expect(densityCss).toContain(
      ':root[data-density="comfortable"]{--se-row-height:calc(2.75rem * var(--mantine-scale));--se-padding:calc(1rem * var(--mantine-scale));--se-gap:calc(0.25rem * var(--mantine-scale));}',
    );
    expect(densityCss).toContain(
      ':root[data-density="compact"]{--se-row-height:calc(2.125rem * var(--mantine-scale));--se-padding:calc(0.75rem * var(--mantine-scale));--se-gap:calc(0.125rem * var(--mantine-scale));}',
    );
    expect(densityCss).not.toContain("px");
  });
});

describe("font scale", () => {
  it("defaults to 100 %", () => {
    expect(DEFAULT_APPEARANCE.fontScale).toBe(100);
    expect(layoutOf({}).scale).toBe(1);
  });

  it.each([
    [87.5, 0.875],
    [93.75, 0.9375],
    [100, 1],
    [106.25, 1.0625],
    [112.5, 1.125],
  ] as const)("step %s is Mantine's scale %s", (fontScale, expected) => {
    expect(layoutOf({ fontScale }).scale).toBe(expected);
  });
});
