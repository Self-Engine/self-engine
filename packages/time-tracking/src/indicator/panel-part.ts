// Which part the timer's Indicator Panel shows: the module's own state (D358), outside React, so
// that a Notice's action or a Command asks for "Stop at …" before it opens the panel through the
// Shell's function. A few bytes: the timer's actions import it, the panel's code stays apart.

/** The form for project, note and start, or "Stop at …". */
export type PanelPart = "edit" | "stopAt";

/** Switches the open panel to a part, asking first when its form holds unsaved changes. */
type Switch = (part: PanelPart) => void;

/** The part the next opening shows. */
let pending: PanelPart = "edit";
let openPanel: Switch | undefined;

export const panelPart = {
  /**
   * Asks for `part`: the open panel switches to it, asking first when its form holds unsaved
   * changes; a closed one shows it when it opens next, which the caller does right after.
   */
  request: (part: PanelPart) => {
    if (openPanel === undefined) pending = part;
    else openPanel(part);
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
