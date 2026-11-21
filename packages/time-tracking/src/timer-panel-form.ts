// How a Notice's action or a Command brings up the form of the timer's Indicator Panel (D372,
// ADR 0037): the module's own state, outside React. A few bytes, outside `src/indicator/`, since
// a Command uses it as well as the indicator and the panel. One record, written only through the
// functions below: the indicator says whether its panel is closed, and the panel's content says
// while it shows a timer.

import type { TimerActionOptions } from "./timer-actions.tsx";

const state: {
  /** Switches the open panel to its form, while its content shows a timer. */
  showForm: (() => void) | undefined;
  /** Opens the closed panel: the indicator's, while it is on screen and its panel is closed. */
  openClosed: (() => void) | undefined;
} = { showForm: undefined, openClosed: undefined };

export const timerPanel = {
  /**
   * Shows the timer's form. A panel that shows "Stop at …" switches to it, asking first when
   * that form holds unsaved changes. An open panel that still loads or shows no timer stays as it
   * is. A closed one opens through `open`, by default the indicator's opener, and every opening
   * shows the form. A Command passes the Shell's opener, since the indicator may not be on
   * screen yet; the Shell's opener leaves an open panel open as well.
   */
  showForm: (open = state.openClosed) => {
    if (state.showForm !== undefined) state.showForm();
    else open?.();
  },
  /**
   * The indicator hands in its opener while its panel is closed, and nothing while it is open,
   * so that `showForm` never closes the panel it asks to open.
   */
  register: (openClosed: (() => void) | undefined) => {
    state.openClosed = openClosed;
    return () => {
      if (state.openClosed === openClosed) state.openClosed = undefined;
    };
  },
  /** The content of the open panel takes the requests while it shows a timer. */
  attach: (showForm: () => void) => {
    state.showForm = showForm;
    return () => {
      if (state.showForm === showForm) state.showForm = undefined;
    };
  },
};

/**
 * The actions of the indicator and the panel: the Notice of a clock before the start switches the
 * open panel to the timer's form, or opens the closed one (D372).
 */
export const FORM_IN_PLACE: TimerActionOptions = { openForm: () => timerPanel.showForm() };
