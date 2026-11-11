import { describe, expect, it } from "vite-plus/test";
import { channelBadge, historyKind, reservesWindowButtons, versionInfo } from "./env.ts";

describe("historyKind", () => {
  it("uses hash history in Electron, where the preload installs the bridge", () => {
    expect(historyKind({ desktopBridge: { platform: "darwin", channel: "stable", version: "1.0.0" } })).toBe("hash");
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
    expect(channelBadge({ desktopBridge: { platform: "darwin", channel, version: "1.0.0" } })).toBe(badge);
  });

  it("shows nothing on the web", () => {
    expect(channelBadge({})).toBeUndefined();
  });
});

describe("reservesWindowButtons", () => {
  it("keeps the strip free in the macOS desktop app", () => {
    expect(
      reservesWindowButtons({ desktopBridge: { platform: "darwin", channel: "stable", version: "1.0.0" } }),
    ).toBe(true);
  });

  it("wastes no room on the Windows desktop app", () => {
    expect(reservesWindowButtons({ desktopBridge: { platform: "win32", channel: "stable", version: "1.0.0" } })).toBe(
      false,
    );
  });

  it("wastes no room on the web", () => {
    expect(reservesWindowButtons({})).toBe(false);
  });
});

describe("versionInfo", () => {
  const MAC_BROWSER =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

  it("takes version and channel from the bridge in the desktop app, not from the build", () => {
    const nightly = "0.4.0-nightly.20261112.3";
    expect(
      versionInfo(
        { desktopBridge: { platform: "darwin", channel: "nightly", version: nightly } },
        { userAgent: MAC_BROWSER },
        "0.0.1",
      ),
    ).toEqual({ version: nightly, channel: "nightly", operatingSystem: "macOS" });
  });

  it.each([
    ["darwin", "macOS"],
    ["win32", "Windows"],
    ["linux", "Linux"],
  ])("names the desktop platform %s as %s", (platform, operatingSystem) => {
    expect(
      versionInfo(
        { desktopBridge: { platform, channel: "stable", version: "1.0.0" } },
        { userAgent: "" },
        "0.0.1",
      ).operatingSystem,
    ).toBe(operatingSystem);
  });

  it("shows the version the build inserted on the web, without a channel", () => {
    expect(versionInfo({}, { userAgent: MAC_BROWSER }, "0.0.1")).toEqual({
      version: "0.0.1",
      operatingSystem: "macOS",
    });
  });

  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0", "Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", "Linux"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0.0.0 Mobile", "Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "iOS"],
    ["Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "iOS"],
    ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/141.0.0.0", "ChromeOS"],
  ])("reads the operating system of a browser from %j", (userAgent, operatingSystem) => {
    expect(versionInfo({}, { userAgent }, "0.0.1").operatingSystem).toBe(operatingSystem);
  });

  it("passes on a platform it has no name for instead of guessing", () => {
    expect(
      versionInfo(
        { desktopBridge: { platform: "freebsd", channel: "dev", version: "0.0.1" } },
        { userAgent: "" },
        "0.0.1",
      ).operatingSystem,
    ).toBe("freebsd");
    expect(versionInfo({}, { userAgent: "SomeBot/1.0" }, "0.0.1").operatingSystem).toBe(
      "SomeBot/1.0",
    );
  });
});
