// Which part the timer's Indicator Panel shows: the module's own state (D358, ADR 0037), outside
// React, so that a Notice's action or a Command asks for "Stop at …" before it opens the panel. A
// few bytes, outside `src/indicator/`, since a Command uses it as well as the indicator and the
// panel. One record, written only through the functions below: `show` asks for a part, the
// indicator says whether the panel is closed, and the panel's part takes the requests.

import type { TimerActionOptions } from "./timer-actions.tsx";

/** The form for project, note and start, or "Stop at …". */
export type PanelPart = "edit" | "stopAt";

/** Switches the open panel to a part, asking first when its form holds unsaved changes. */
type Switch = (part: PanelPart) => void;

const state: {
  /** The part the panel's next part shows first. */
  pending: PanelPart;
  /** The switch of the open panel's part, while it shows one. */
  switchTo: Switch | undefined;
  /** Opens the closed panel: the indicator's, while it is on screen and its panel is closed. */
  openClosed: (() => void) | undefined;
} = { pending: "edit", switchTo: undefined, openClosed: undefined };

export const panelPart = {
  /**
   * Shows `part`. A panel that shows a part switches to it, asking first when its form holds
   * unsaved changes. Otherwise the panel's next part shows it: an open panel that still loads or
   * shows no timer stays open, and a closed one opens through `open`, by default the
   * indicator's opener. A Command passes the Shell's opener, since the indicator may not be on
   * screen yet; the Shell's opener leaves an open panel open as well.
   */
  show: (part: PanelPart, open = state.openClosed) => {
    if (state.switchTo !== undefined) {
      state.switchTo(part);
      return;
    }
    state.pending = part;
    open?.();
  },
  /**
   * The indicator hands in its opener while its panel is closed, and nothing while it is open,
   * so that `show` never closes the panel it asks to open. A closed panel spends the request no
   * part took, such as one that arrived while the panel showed no timer: the next opening, from
   * a click on the indicator, shows the form. This also starts each mounted indicator afresh.
   */
  register: (openClosed: (() => void) | undefined) => {
    state.openClosed = openClosed;
    if (openClosed !== undefined && state.switchTo === undefined) state.pending = "edit";
    return () => {
      if (state.openClosed === openClosed) state.openClosed = undefined;
    };
  },
  /** The part an opening panel shows first. */
  opening: (): PanelPart => state.pending,
  /**
   * The part of the open panel takes the requests until it goes. The request it opened with is
   * spent: the next opening, such as from a click on the indicator, shows the form again.
   */
  attach: (switchTo: Switch) => {
    state.switchTo = switchTo;
    state.pending = "edit";
    return () => {
      if (state.switchTo === switchTo) state.switchTo = undefined;
    };
  },
};

/**
 * The actions of the indicator and the panel: the Notice of a clock before the start switches the
 * open panel to "Stop at …", or opens the closed one there (D358).
 */
export const STOP_AT_IN_PLACE: TimerActionOptions = { openStopAt: () => panelPart.show("stopAt") };
