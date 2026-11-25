import { describe, expect, it } from "vite-plus/test";
import { CROP, ICON_COLORS, README_MARK_COLORS, STAR_PATH } from "./northstar.ts";
import { appIconSvg, avatarSvg, bannerSvg, markSvg } from "./northstar-svg.ts";

describe("the Northstar's SVG documents", () => {
  it.each([
    ["appIconSvg", appIconSvg(ICON_COLORS.terracotta), "0 0 1024 1024"],
    ["avatarSvg", avatarSvg(ICON_COLORS.terracotta), "0 0 512 512"],
    [
      "bannerSvg",
      bannerSvg(ICON_COLORS.terracotta, { title: "T", lines: ["a", "b"] }),
      "0 0 1280 640",
    ],
    ["markSvg", markSvg(README_MARK_COLORS.light), `0 0 ${CROP.size} ${CROP.size}`],
  ])("%s draws the star on its own canvas", (_name, svg, viewBox) => {
    expect(svg).toContain(`viewBox="${viewBox}"`);
    expect(svg).toContain(`d="${STAR_PATH}"`);
  });

  it("paints an icon in the colors it is given", () => {
    const svg = appIconSvg(ICON_COLORS.nightBlue);
    for (const color of [
      ICON_COLORS.nightBlue.backgroundStart,
      ICON_COLORS.nightBlue.backgroundEnd,
      ICON_COLORS.nightBlue.starTop,
      ICON_COLORS.nightBlue.ring,
    ]) {
      expect(svg).toContain(color);
    }
  });

  it("escapes the banner's text", () => {
    const svg = bannerSvg(ICON_COLORS.terracotta, { title: "A & B", lines: ["<x>", "y"] });
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("&lt;x&gt;");
  });
});

describe("ICON_COLORS", () => {
  it("gives every icon its own background and star", () => {
    const palettes = Object.values(ICON_COLORS);
    expect(new Set(palettes.map((colors) => colors.backgroundStart)).size).toBe(palettes.length);
    expect(new Set(palettes.map((colors) => colors.starBottom)).size).toBe(palettes.length);
  });
});
