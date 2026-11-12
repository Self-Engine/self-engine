import type { CSSProperties } from "react";

// Plain CSS that moves the window in Electron and means nothing in a browser, so no component
// needs a platform check. Electron cuts `no-drag` out of what `drag` claims, whatever is on top.

/** Lets the element move the window, where the window has no title bar of its own. */
export const WINDOW_DRAG_STYLE = { WebkitAppRegion: "drag" } as CSSProperties;

/** Cuts the element, such as a control or a dialog, out of the window's drag region. */
export const NOT_WINDOW_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as CSSProperties;
