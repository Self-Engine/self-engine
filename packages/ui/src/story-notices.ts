// For Stories only, here and in the packages that show a Notice. A subpath of its own, like
// `story-timers`, so that it stays out of what the package's main entry ships.

import { notifications } from "@mantine/notifications";

/**
 * Removes every Notice. Mantine keeps them in a store that outlives a story, so one that a story
 * left open would show in the next: call it in `beforeEach`.
 */
export function clearNotices(): void {
  notifications.clean();
}
