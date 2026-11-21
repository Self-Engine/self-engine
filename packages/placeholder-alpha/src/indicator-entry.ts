import type { IndicatorWithPanel } from "@self-engine/shell";

/**
 * The module's Module Indicator and its Indicator Panel, both code that loads after the first
 * paint. Its own file, so the Command that opens the panel names it without the contribution.
 */
export const indicator = {
  load: () => import("./indicator/index.tsx"),
  panel: () => import("./indicator/panel.tsx"),
} satisfies IndicatorWithPanel;
