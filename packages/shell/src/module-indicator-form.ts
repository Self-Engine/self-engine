import type { LayoutStep } from "./geometry.ts";

/** Which of its two forms a Module Indicator shows. The Shell decides it, never the module. */
export type IndicatorForm = "full" | "short";

const FORM_AT: Readonly<Record<LayoutStep, IndicatorForm>> = {
  wide: "full",
  medium: "full",
  narrow: "short",
  phone: "short",
};

export const indicatorForm = (step: LayoutStep): IndicatorForm => FORM_AT[step];
