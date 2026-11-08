// Checks the Start Cache's CSS against the pinned Mantine, whose defaults exist only in CSS.

import mantineVariablesCss from "@mantine/core/styles/default-css-variables.css?raw";
import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  serializeStartCache,
} from "../core/index.ts";

describe("the Start Cache against the pinned Mantine", () => {
  // Two attribute-or-class parts: the cached rule adds an element and so wins the first frame.
  it.each(["dark", "light"])("outranks Mantine's %s variables", (mode) => {
    expect(mantineVariablesCss).toContain(`:root[data-mantine-color-scheme='${mode}']`);

    const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);
    const cache = JSON.parse(serializeStartCache("system", resolved)) as {
      css: Record<string, string>;
    };
    expect(cache.css[mode]?.startsWith("html:root[data-mantine-color-scheme]{")).toBe(true);
  });
});
