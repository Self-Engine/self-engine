import type { CSSProperties } from "react";

// Plain CSS that Electron reads and a browser ignores. It cuts a dialog out of the window's drag
// region, whatever lies under it.
export const NOT_WINDOW_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as CSSProperties;

export const ACTIVE_ENTRY_VARS = () => ({
  root: {
    "--nl-bg": "var(--se-module-soft)",
    "--nl-color": "var(--se-module-text)",
    "--nl-hover": "var(--se-module-soft)",
  },
  children: {},
});
