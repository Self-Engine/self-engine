import type { OpenIndicatorPanel } from "@self-engine/shell";
import { indicator } from "./indicator-entry.ts";
import { timerPanel } from "./timer-panel-form.ts";

/**
 * For a Command a person starts: shows the form of the timer's Indicator Panel through the
 * Shell's function from the Command's context, for the Notice of a clock before the start (D372).
 */
export const timerFormThrough = (openIndicatorPanel: OpenIndicatorPanel) => () =>
  timerPanel.showForm(() => openIndicatorPanel(indicator));
