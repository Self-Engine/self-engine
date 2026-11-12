export interface LargeResultReport {
  readonly kind: "large-result";
  readonly entry: string;
  readonly rows: number;
}

/** Constant-time check: never walks the rows, and reporting cannot break a query. */
export function reportLargeResult(
  entry: string,
  kind: "window" | "small-set" | "pages" | undefined,
  output: unknown,
  report: ((value: LargeResultReport) => void) | undefined,
) {
  if (
    (kind === "window" || kind === "small-set") &&
    Array.isArray(output) &&
    output.length >= 1000
  ) {
    try {
      report?.({ kind: "large-result", entry, rows: output.length });
    } catch {
      // Reporting must never turn a successful query into a failed call.
    }
  }
}
