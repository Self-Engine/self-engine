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

  it("sets row height, padding and gap in rem under the data-density attribute", () => {
    const { densityCss } = layoutOf({});
    // 44/16/4 px and 34/12/2 px at the 16 px root size.
    expect(densityCss).toContain(
      ':root[data-density="comfortable"]{--se-row-height:2.75rem;--se-padding:1rem;--se-gap:0.25rem;}',
    );
    expect(densityCss).toContain(
      ':root[data-density="compact"]{--se-row-height:2.125rem;--se-padding:0.75rem;--se-gap:0.125rem;}',
    );
    expect(densityCss).not.toContain("px");
  });

  it("leaves Mantine's control sizes alone when comfortable", () => {
    expect(layoutOf({ density: "comfortable" }).mantineComponents).toEqual({});
  });

  it("lowers the default size of inputs and buttons to xs when compact", () => {
    expect(layoutOf({ density: "compact" }).mantineComponents).toEqual({
      Input: { defaultProps: { size: "xs" } },
      Button: { defaultProps: { size: "xs" } },
    });
  });
});

describe("font scale", () => {
  it("defaults to 100 %", () => {
    expect(DEFAULT_APPEARANCE.fontScale).toBe(100);
    expect(layoutOf({}).rootFontSize).toBe("100%");
  });

  it.each([
    [87.5, "87.5%"],
    [93.75, "93.75%"],
    [100, "100%"],
    [106.25, "106.25%"],
    [112.5, "112.5%"],
  ] as const)("step %s is the percentage %s on the root element", (fontScale, expected) => {
    expect(layoutOf({ fontScale }).rootFontSize).toBe(expected);
  });
});
