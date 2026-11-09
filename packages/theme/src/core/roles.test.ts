import { describe, expect, it } from "vite-plus/test";
import { roleColor } from "./roles.ts";

describe("roleColor", () => {
  it("is a CSS color that follows the Color Role's variable", () => {
    expect(roleColor("textMuted")).toBe("var(--se-text-muted)");
  });
});
