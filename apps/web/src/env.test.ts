import { describe, expect, it } from "vite-plus/test";
import {
  type DesktopBridge,
  type DesktopChannel,
  channelBadge,
  historyKind,
  reservesWindowButtons,
} from "./env.ts";

function bridge(platform: string, channel: DesktopChannel): DesktopBridge {
  return { platform, channel, requestDataPort: () => {}, retryDataProcess: () => {} };
}

describe("historyKind", () => {
  it("uses hash history in Electron, where the preload installs the bridge", () => {
    expect(historyKind({ desktopBridge: bridge("darwin", "stable") })).toBe("hash");
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
    expect(channelBadge({ desktopBridge: bridge("darwin", channel) })).toBe(badge);
  });

  it("shows nothing on the web", () => {
    expect(channelBadge({})).toBeUndefined();
  });
});

describe("reservesWindowButtons", () => {
  it("keeps the strip free in the macOS desktop app", () => {
    expect(reservesWindowButtons({ desktopBridge: bridge("darwin", "stable") })).toBe(true);
  });

  it("wastes no room on the Windows desktop app", () => {
    expect(reservesWindowButtons({ desktopBridge: bridge("win32", "stable") })).toBe(false);
  });

  it("wastes no room on the web", () => {
    expect(reservesWindowButtons({})).toBe(false);
  });
});
