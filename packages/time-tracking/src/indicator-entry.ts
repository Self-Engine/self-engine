import type { IndicatorWithPanel } from "@self-engine/shell";

/**
 * The timer's Module Indicator and its Indicator Panel, both code that loads after the first paint
 * (D358, D359): the indicator in an idle moment, the panel at its first opening or when the Shell
 * preloads it. Its own file, so a Command or a Notice's action names it without the contribution.
 */
export const indicator = {
  load: () => import("./indicator/index.tsx"),
  panel: () => import("./indicator/panel.tsx"),
} satisfies IndicatorWithPanel;
