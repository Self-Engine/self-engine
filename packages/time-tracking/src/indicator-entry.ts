import type { IndicatorWithoutPanel } from "@self-engine/shell";

/**
 * The timer's Module Indicator, code that loads after the first paint (D359). Its own file, so a
 * Command names it without the contribution. Its Indicator Panel comes with #350.
 */
export const indicator = {
  load: () => import("./indicator/index.tsx"),
} satisfies IndicatorWithoutPanel;
