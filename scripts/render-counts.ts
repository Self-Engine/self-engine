/** React's DevTools commit hook counts committed function-component work, not DOM mutations.
 * Aborted renders are excluded. This intentionally uses React's private Fiber flags; review
 * it when upgrading React. It never enters the shipped application. */
export interface Fiber {
  readonly alternate?: Fiber | null;
  readonly tag: number;
  readonly flags: number;
  readonly type?: { readonly displayName?: string; readonly name?: string } | null;
  readonly child: Fiber | null;
  readonly sibling: Fiber | null;
}
export interface RenderCounts {
  commits: number;
  components: Record<string, number>;
}

export function countCommit(
  root: Fiber,
  counts: RenderCounts,
  previous: WeakMap<Fiber, Fiber>,
): void {
  counts.commits++;
  const visit = (fiber: Fiber | null): void => {
    if (fiber === null) return;
    // FunctionComponent, ForwardRef, SimpleMemoComponent; PerformedWork = 1.
    const last =
      previous.get(fiber) ?? (fiber.alternate ? previous.get(fiber.alternate) : undefined);
    if (last !== fiber && [0, 11, 15].includes(fiber.tag) && (fiber.flags & 1) !== 0) {
      const name = fiber.type?.displayName || fiber.type?.name || "Anonymous";
      counts.components[name] = (counts.components[name] ?? 0) + 1;
    }
    previous.set(fiber, fiber);
    if (fiber.alternate) previous.set(fiber.alternate, fiber);
    visit(fiber.child);
    visit(fiber.sibling);
  };
  visit(root);
}

export function difference(after: RenderCounts, before: RenderCounts): RenderCounts {
  const components: Record<string, number> = {};
  for (const [name, count] of Object.entries(after.components)) {
    const delta = count - (before.components[name] ?? 0);
    if (delta !== 0) components[name] = delta;
  }
  return { commits: after.commits - before.commits, components };
}

export interface RenderReport {
  readonly version: 1;
  readonly revision: string;
  readonly scenarios: Record<string, RenderCounts>;
}

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
