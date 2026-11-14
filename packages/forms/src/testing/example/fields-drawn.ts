// The render-count measurement of the example's stories (D256, D318): how often each field drew
// while one act ran, counted from the moment React finished the work it had due.

import {
  afterTheCommitsNowDue,
  difference,
  renderCounts,
} from "@self-engine/ui/story-render-counts";

/** How often each of `fields`, by component name, drew while `act` ran and its effects settled. */
export async function fieldsDrawnDuring<Field extends string>(
  fields: readonly Field[],
  act: () => Promise<unknown>,
): Promise<Record<Field, number>> {
  await afterTheCommitsNowDue();
  const before = renderCounts();
  await act();
  await afterTheCommitsNowDue();
  const drawn = difference(renderCounts(), before).components;
  return Object.fromEntries(fields.map((name) => [name, drawn[name] ?? 0])) as Record<
    Field,
    number
  >;
}
