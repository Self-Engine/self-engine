import { describe, expect, it } from "vite-plus/test";
import { historyKind } from "./env.ts";

describe("historyKind", () => {
  it("uses hash history in Electron, where the preload installs the bridge", () => {
    expect(historyKind({ desktopBridge: { platform: "darwin" } })).toBe("hash");
  });

  it("uses browser history on the web", () => {
    expect(historyKind({})).toBe("browser");
  });
});
