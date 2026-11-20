import { expect, test, vi } from "vite-plus/test";
import { watchVisibility } from "./page-visibility.ts";

/** A page whose visibility the test sets, like the browser does when the window is hidden. */
function testPage(start: DocumentVisibilityState = "visible") {
  const events = new EventTarget();
  const added = vi.spyOn(events, "addEventListener");
  const page = {
    visibilityState: start,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const becomes = (state: DocumentVisibilityState) => {
    page.visibilityState = state;
    events.dispatchEvent(new Event("visibilitychange"));
  };
  return { page, becomes, added };
}

test("the window's visibility is read from the page and each change is told", () => {
  const { page, becomes } = testPage("hidden");
  const visibility = watchVisibility(page);
  const seen: boolean[] = [];
  visibility.onChange(() => seen.push(visibility.visible()));
  expect(visibility.visible()).toBe(false);

  becomes("visible");
  becomes("hidden");
  expect(seen).toEqual([true, false]);
});

test("every reader shares one listener on the page", () => {
  const { page, becomes, added } = testPage();
  const visibility = watchVisibility(page);
  const first = vi.fn();
  const second = vi.fn();
  visibility.onChange(first);
  visibility.onChange(second);
  becomes("hidden");
  expect(added).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
});

test("a reader that stopped hears nothing more, and the same function stops one at a time", () => {
  const { page, becomes } = testPage();
  const visibility = watchVisibility(page);
  const listener = vi.fn();
  const stopFirst = visibility.onChange(listener);
  const stopSecond = visibility.onChange(listener);
  stopFirst();
  becomes("hidden");
  expect(listener).toHaveBeenCalledTimes(1);
  stopSecond();
  becomes("visible");
  expect(listener).toHaveBeenCalledTimes(1);
});
