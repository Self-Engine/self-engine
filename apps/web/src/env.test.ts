import { describe, expect, it } from "vite-plus/test";
import { channelBadge, historyKind } from "./env.ts";

describe("historyKind", () => {
  it("uses hash history in Electron, where the preload installs the bridge", () => {
    expect(historyKind({ desktopBridge: { platform: "darwin", channel: "stable" } })).toBe("hash");
  });

  it("uses browser history on the web", () => {
    expect(historyKind({})).toBe("browser");
  });
});

describe("channelBadge", () => {
  it.each([
    ["dev", "Dev"],
    ["nightly", "Nightly"],
    ["stable", undefined],
  ] as const)("marks %s as %s", (channel, badge) => {
    expect(channelBadge({ desktopBridge: { platform: "darwin", channel } })).toBe(badge);
  });

  it("shows nothing on the web", () => {
    expect(channelBadge({})).toBeUndefined();
  });
});
