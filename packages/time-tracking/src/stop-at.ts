import type { OpenIndicatorPanel } from "@self-engine/shell";
import { indicator } from "./indicator-entry.ts";
import { panelPart } from "./timer-panel-part.ts";

/**
 * For a Command a person starts: opens the timer's Indicator Panel at "Stop at …" through the
 * Shell's function from the Command's context, for the Notice of a clock before the start.
 */
export const stopAtThrough = (openIndicatorPanel: OpenIndicatorPanel) => () =>
  panelPart.show("stopAt", () => openIndicatorPanel(indicator));
