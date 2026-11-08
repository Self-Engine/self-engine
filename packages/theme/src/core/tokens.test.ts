import { describe, expect, it } from "vite-plus/test";
import { tokenVariables } from "./index.ts";

describe("motion tokens", () => {
  it("are 150 ms and 200 ms normally", () => {
    const variables = tokenVariables({ reducedMotion: false });
    expect(variables["--se-motion-fast"]).toBe("150ms");
    expect(variables["--se-motion-base"]).toBe("200ms");
  });

  it("drop to 0 under reduced motion, with a unit so they stay valid CSS times", () => {
    const variables = tokenVariables({ reducedMotion: true });
    expect(variables["--se-motion-fast"]).toBe("0ms");
    expect(variables["--se-motion-base"]).toBe("0ms");
  });
});

describe("the tabular-number token", () => {
  it.each([false, true])(
    "is a font-variant-numeric value (reduced motion: %s)",
    (reducedMotion) => {
      expect(tokenVariables({ reducedMotion })["--se-tabular-nums"]).toBe("tabular-nums");
    },
  );
});
