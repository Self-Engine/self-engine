// For Stories only, here and in the app. A subpath of its own, so that `storybook` stays out of
// what the package's main entry ships.
//
// A Mantine Popover, Drawer, Modal or Menu moves in two steps, both after its state has changed:
// Mantine waits two animation frames, then fades or slides the surface for its duration. A busy
// browser paints those frames late (#179). Opening, the surface is in the document, and can hold
// the focus, while it is still transparent: a query finds it, but `toBeVisible()` on it or on
// anything inside it fails, and its place on the screen is not yet its own. Closing, it stays in
// the document until its exit has run. A person never meets either state, so a story waits until
// the surface has settled instead of checking it in between.

import { expect, waitFor } from "storybook/test";

/** How long one step waits, as Testing Library's `waitFor` takes it. */
export interface SettleOptions {
  readonly timeout?: number;
}

/**
 * The animations that come to an end on `surface` or on what holds it: its fade and slide. One
 * that never ends, a spinner's, is no transition to wait for.
 */
function moving(surface: Element): Animation[] {
  const found: Animation[] = [];
  for (let node: Element | null = surface; node !== null; node = node.parentElement) {
    for (const animation of node.getAnimations()) {
      if (animation.effect?.getComputedTiming().endTime !== Infinity) found.push(animation);
    }
  }
  return found;
}

/**
 * Whether `surface`, or what holds it, is set to the transparent end of its transition: Mantine
 * sets that before an opening starts and once a closing has begun.
 */
function headedOut(surface: Element): boolean {
  for (let node: Element | null = surface; node !== null; node = node.parentElement) {
    if (node instanceof HTMLElement && node.style.opacity === "0") return true;
  }
  return false;
}

/**
 * Waits until `surface` stands fully shown, in the two steps it takes: first until its opening has
 * begun, then until it is visible with no fade or slide left on it or on what holds it. Each step
 * gets its own wait, as finding the surface does. Takes the element or the query that finds it,
 * and returns the element.
 *
 *     const dialog = await settled(screen.findByRole("dialog", { name: "Projects" }));
 */
export async function settled<Surface extends Element>(
  surface: Surface | Promise<Surface>,
  options?: SettleOptions,
): Promise<Surface> {
  const element = await surface;
  await waitFor(
    () => expect(headedOut(element), "the surface has begun to open").toBe(false),
    options,
  );
  await waitFor(async () => {
    await expect(element).toBeVisible();
    await expect(moving(element)).toEqual([]);
  }, options);
  return element;
}

/** What a query hands back: one surface or none, as `queryBy…`, or a list, as `queryAllBy…`. */
type Found = Element | null | readonly Element[];

const listed = (found: Found): readonly Element[] =>
  found === null ? [] : found instanceof Element ? [found] : found;

/**
 * Waits until the surfaces that `query` finds have left the document, in the two steps it takes:
 * first until their exit has begun, then until they are gone. Each step gets its own wait, as
 * finding a surface and `settled` do when it opens.
 *
 *     await closed(() => screen.queryByRole("dialog", { name: "Projects" }));
 */
export async function closed(query: () => Found, options?: SettleOptions): Promise<void> {
  await waitFor(async () => {
    const staying = listed(query()).filter((surface) => !headedOut(surface));
    await expect(staying, "the surfaces have begun to close").toEqual([]);
  }, options);
  await waitFor(() => expect(listed(query())).toEqual([]), options);
}
