// The window's visibility, watched once for the whole page: the page clock stops while the window
// is hidden, and the device's zone is read again when it shows.

import type { PageVisibility } from "@self-engine/time/react";

/** Where the window says that it became visible or hidden: the document, in the app. */
export type VisibilityPage = Pick<Document, "visibilityState"> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** One listener on `page` for the lifetime of the page, shared by every reader. */
export function watchVisibility(page: VisibilityPage): PageVisibility {
  const listeners = new Set<() => void>();
  page.addEventListener("visibilitychange", () => {
    for (const listener of listeners) listener();
  });
  return {
    visible: () => page.visibilityState === "visible",
    onChange: (listener) => {
      // A wrapper per call, so the same function added twice stops one at a time.
      const entry = () => listener();
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
  };
}
