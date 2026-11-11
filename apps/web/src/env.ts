import type { DesktopBridge, DesktopChannel } from "@self-engine/desktop-bridge";

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
