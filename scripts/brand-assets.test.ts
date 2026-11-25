import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { githubPictures, readmeLogos } from "./brand-assets.ts";

const ROOT = resolve(import.meta.dirname, "..");

/** The width and height in a PNG's IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe("readmeLogos", () => {
  it.each(Object.entries(readmeLogos()))(
    "%s matches the Northstar: run `pnpm brand` after changing it",
    (path, svg) => {
      expect(readFileSync(join(ROOT, path), "utf8")).toBe(svg);
    },
  );

  it("is referenced by the README in both color schemes", () => {
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    for (const path of Object.keys(readmeLogos())) expect(readme).toContain(path);
  });
});

describe("githubPictures", () => {
  it("draws them in the sizes GitHub asks for", () => {
    const pictures = githubPictures();
    expect(pngSize(pictures["avatar.png"]!)).toEqual([500, 500]);
    expect(pngSize(pictures["social-preview.png"]!)).toEqual([1280, 640]);
  });
});
