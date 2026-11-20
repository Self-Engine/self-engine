import { createAppSettingsStore } from "./app-settings.ts";
import { dataConnection } from "./desktop-data.ts";

// Until the page has an error log (#37), the console keeps failures visible.
export function reportPageError(error: Error): void {
  console.error(error);
}

/**
 * The app's one store. `main.tsx` waits for its `load` before the first render, which the local
 * copy answers without waiting for the Data Process.
 */
export const settingsStore = createAppSettingsStore(
  { getStorage: () => localStorage, getEvents: () => window },
  // Only the desktop app has a Data Process (D263). Tests import this file in Node, without one.
  typeof window === "undefined" || window.desktopBridge === undefined ? undefined : dataConnection,
  ({ error }) => reportPageError(error),
);
