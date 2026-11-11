/** The release channels; `Channel` in apps/desktop/src/channel.ts is the source. */
export type DesktopChannel = "dev" | "nightly" | "stable";

/** What the Electron preload (apps/desktop/src/preload.ts) installs on the page's window. */
export interface DesktopBridge {
  readonly platform: string;
  readonly channel: DesktopChannel;
  /** Asks for a port to the data process; it arrives as a window message (desktop-data.ts). */
  requestDataPort(): void;
  /** Starts the data process again after repeated crashes stopped it (desktop-data.ts). */
  retryDataProcess(): void;
}

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
