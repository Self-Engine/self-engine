import type { DesktopBridge, DesktopChannel } from "@self-engine/desktop-bridge";
import type { VersionInfo } from "@self-engine/settings-area";

declare global {
  interface Window {
    /** Installed by the Electron preload (apps/desktop/src/preload.ts); absent on the web. */
    readonly desktopBridge?: DesktopBridge;
  }
}

export type HistoryKind = "hash" | "browser";

/** Hash history in Electron, whose custom protocol has no server routes; browser history on the web. */
export function historyKind(win: Pick<Window, "desktopBridge">): HistoryKind {
  return win.desktopBridge === undefined ? "browser" : "hash";
}

const CHANNEL_BADGES: Readonly<Record<DesktopChannel, string | undefined>> = {
  dev: "Dev",
  nightly: "Nightly",
  stable: undefined,
};

/** The macOS desktop app is the only place where window buttons sit on top of the page. */
export function reservesWindowButtons(win: Pick<Window, "desktopBridge">): boolean {
  return win.desktopBridge?.platform === "darwin";
}

/** The badge that marks a pre-release app; stable and the web have none. */
export function channelBadge(win: Pick<Window, "desktopBridge">): string | undefined {
  return win.desktopBridge && CHANNEL_BADGES[win.desktopBridge.channel];
}

/** Node's names of the platforms the desktop app is built for. */
const DESKTOP_SYSTEMS: Readonly<Record<string, string>> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
};

// In this order: an iPhone says "like Mac OS X", and Android and ChromeOS say "Linux" or "X11".
const BROWSER_SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux|X11/, "Linux"],
];

/**
 * Which app is running, for the settings' View About. The desktop app takes version and channel
 * from the bridge, and has no version when the bridge has none; on the web the build inserted the
 * version and there is no channel.
 */
export function versionInfo(
  win: Pick<Window, "desktopBridge">,
  browser: Pick<Navigator, "userAgent">,
  builtVersion: string,
): VersionInfo {
  const bridge = win.desktopBridge;
  if (bridge) {
    return {
      // Never the web build's version, which is another app's.
      ...(bridge.version !== undefined && { version: bridge.version }),
      channel: bridge.channel,
      operatingSystem: DESKTOP_SYSTEMS[bridge.platform] ?? bridge.platform,
    };
  }
  const system = BROWSER_SYSTEMS.find(([pattern]) => pattern.test(browser.userAgent));
  return { version: builtVersion, operatingSystem: system?.[1] ?? browser.userAgent };
}
