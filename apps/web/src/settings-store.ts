import { createLocalSettingsAdapter, createSettingsStore } from "@self-engine/settings";

/** The app's one store. `main.tsx` waits for its `load` before the first render. */
export const settingsStore = createSettingsStore({
  adapters: {
    synced: createLocalSettingsAdapter(
      () => localStorage,
      "synced",
      () => window,
    ),
    device: createLocalSettingsAdapter(
      () => localStorage,
      "device",
      () => window,
    ),
  },
  // Until the error log and notifications exist (#37, #21), the console keeps failures visible.
  onError: ({ error, operation, scope }) => {
    console.error(`Settings ${operation} failed for ${scope}`, error);
  },
});
