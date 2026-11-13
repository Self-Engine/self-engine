// The comparison of `pnpm renders`. The count itself is shared with the render-count gate
// story: `@self-engine/ui/story-render-counts`.

import type { RenderCounts } from "@self-engine/ui/story-render-counts";

export interface RenderReport {
  readonly version: 1;
  readonly revision: string;
  readonly scenarios: Record<string, RenderCounts>;
}

/** Format scenario totals and per-component deltas without applying a pass/fail budget. */
export function compareReports(current: RenderReport, baseline?: RenderReport): string {
  if (
    baseline &&
    (baseline.version !== current.version ||
      Object.keys(baseline.scenarios).sort().join() !==
        Object.keys(current.scenarios).sort().join())
  ) {
    throw new Error("Incompatible render reports: use the same scenarios and report version");
  }
  return Object.entries(current.scenarios)
    .map(([scenario, counts]) => {
      const total = Object.values(counts.components).reduce((a, b) => a + b, 0);
      const previous = baseline?.scenarios[scenario];
      const delta = previous
        ? total - Object.values(previous.components).reduce((a, b) => a + b, 0)
        : undefined;
      const rows = [
        ...new Set([...Object.keys(counts.components), ...Object.keys(previous?.components ?? {})]),
      ]
        .map((name): [string, number] => [name, counts.components[name] ?? 0])
        .sort((a, b) => b[1] - a[1])
        .map(
          ([name, count]) =>
            `  ${name}: ${count}${previous ? ` (${count - (previous.components[name] ?? 0) >= 0 ? "+" : ""}${count - (previous.components[name] ?? 0)})` : ""}`,
        );
      return `${scenario}: ${total} component renders, ${counts.commits} commits${delta === undefined ? "" : ` (renders ${delta >= 0 ? "+" : ""}${delta})`}\n${rows.join("\n")}`;
    })
    .join("\n\n");
}
