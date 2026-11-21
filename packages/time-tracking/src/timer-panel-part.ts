// Which part the timer's Indicator Panel shows: the module's own state (D358), outside React, so
// that a Notice's action or a Command asks for "Stop at …" before it opens the panel. A few
// bytes, outside `src/indicator/`, since a Command uses it as well as the indicator and the panel.

/** The form for project, note and start, or "Stop at …". */
export type PanelPart = "edit" | "stopAt";

/** Switches the open panel to a part, asking first when its form holds unsaved changes. */
type Switch = (part: PanelPart) => void;

/** The part the next opening shows. */
let pending: PanelPart = "edit";
let openPanel: Switch | undefined;
let openClosedPanel: (() => void) | undefined;

export const panelPart = {
  /**
   * Asks for `part`: the open panel switches to it, asking first when its form holds unsaved
   * changes; a closed one shows it when it opens next. Whether an open panel took it.
   */
  request: (part: PanelPart): boolean => {
    if (openPanel === undefined) {
      pending = part;
      return false;
    }
    openPanel(part);
    return true;
  },
  /**
   * Shows `part`: in the open panel, or in the closed one, which the indicator opens through the
   * Shell. The indicator and the panel cannot name the indicator's entry for the Shell's
   * `openIndicatorPanel`, which loads them: that would be an import cycle.
   */
  open: (part: PanelPart) => {
    if (!panelPart.request(part)) openClosedPanel?.();
  },
  /** The indicator hands in the Shell's opener of its panel while it is on screen. */
  register: (open: () => void) => {
    openClosedPanel = open;
    return () => {
      if (openClosedPanel === open) openClosedPanel = undefined;
    };
  },
  /** The part an opening panel shows first. */
  opening: (): PanelPart => pending,
  /**
   * The open panel takes the requests until it closes. The request it opened with is spent: the
   * next opening, such as from a click on the indicator, shows the form again.
   */
  attach: (switchTo: Switch) => {
    openPanel = switchTo;
    pending = "edit";
    return () => {
      if (openPanel === switchTo) openPanel = undefined;
    };
  },
};
