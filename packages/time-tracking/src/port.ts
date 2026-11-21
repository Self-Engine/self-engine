import { portHooks } from "@self-engine/data-client/react";
import type { DaySpan } from "@self-engine/time";
import { useMemo } from "react";
import type { TimeEntryFilter, timeTrackingContract } from "./contracts/index.ts";

export type { DayEntry, DaysAnswer, ProjectTotal, SpanDay } from "./contracts/index.ts";

// The module's hooks, built from its Contract and its mount name (D249). The Contract arrives as a
// type only, so its schemas never load with a View (D255); the module names no tables (D248).
const timeTrackingPort = portHooks<typeof timeTrackingContract>("timeTracking");

const useDays = timeTrackingPort.query("days");

/**
 * The entries and sums of a Day Span (D354). It takes the span as `weekOf` computes it: the
 * Query's own input is the schema's input, plain text, and would take any two strings.
 */
export function useSpanDays(span: DaySpan, filter?: TimeEntryFilter) {
  const { first, last } = span;
  const input = useMemo(
    () => (filter === undefined ? { span: { first, last } } : { span: { first, last }, filter }),
    [first, last, filter],
  );
  return useDays(input);
}
