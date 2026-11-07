import type { roundingModes } from "./modules.ts";

export type Rounding = { mode: (typeof roundingModes)[number]; intervalMin: number };

/** Rounds the duration (not the wall-clock end) to the project's interval; never below one interval. */
export function roundedEnd(startAt: number, rawEndAt: number, r: Rounding): number {
  const durMs = rawEndAt - startAt;
  if (r.mode === "none") return rawEndAt;
  const step = r.intervalMin * 60_000;
  const units = durMs / step;
  const rounded = r.mode === "up" ? Math.ceil(units) : r.mode === "down" ? Math.floor(units) : Math.round(units);
  return startAt + Math.max(1, rounded) * step;
}
