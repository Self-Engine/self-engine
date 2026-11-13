// For Stories only. The notices live in Mantine's store, which outlives a story, so a story that
// shows some starts from an empty screen.

import { notifications } from "@mantine/notifications";

/** Removes every notice on screen and in the queue at once. */
export function clearNotices() {
  notifications.clean();
}
