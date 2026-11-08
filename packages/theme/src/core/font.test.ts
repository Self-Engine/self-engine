import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vite-plus/test";
import { FONT_FAMILY } from "./index.ts";

// Read from disk because Vitest empties CSS that is imported as a module.
const bundledInter = readFileSync(
  createRequire(import.meta.url).resolve("@fontsource-variable/inter/wght.css"),
  "utf8",
);

describe("the bundled font", () => {
  it("is declared under the family name the app asks for", () => {
    expect(FONT_FAMILY).toBe('"Inter Variable", sans-serif');
    expect(bundledInter).toContain("font-family: 'Inter Variable'");
  });

  it("loads only from files inside the package, never from the network", () => {
    const sources = [...bundledInter.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(source).toMatch(/^\.\/files\/.+\.woff2$/);
  });
});
