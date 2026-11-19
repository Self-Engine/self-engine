import { createAppSettingsStore } from "./app-settings.ts";
import { dataConnection } from "./desktop-data.ts";

/**
 * The app's one store. `main.tsx` waits for its `load` before the first render, which the local
 * copy answers without waiting for the Data Process.
 */
export const settingsStore = createAppSettingsStore(
  { getStorage: () => localStorage, getEvents: () => window },
  // Only the desktop app has a Data Process (D263).
  window.desktopBridge === undefined ? undefined : dataConnection,
  // Until the error log and notifications exist (#37, #21), the console keeps failures visible.
  ({ error, operation, scope }) => {
    console.error(`Settings ${operation} failed for ${scope}`, error);
  },
);
