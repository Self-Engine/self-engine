declare global {
  interface Window {
    /** Installed by the Electron preload (apps/desktop/src/preload.ts); absent on the web. */
    readonly desktopBridge?: { readonly platform: string };
  }
}

export type HistoryKind = "hash" | "browser";

/** Hash history in Electron, whose custom protocol has no server routes; browser history on the web. */
export function historyKind(win: Pick<Window, "desktopBridge">): HistoryKind {
  return win.desktopBridge === undefined ? "browser" : "hash";
}
