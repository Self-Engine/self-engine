// No runtime import: the story Port loads this file, and the storage code must not load with it.
import type { SETTINGS_TABLE } from "@self-engine/storage";

/** The Settings table: the Time Zone is a Setting. The type keeps the name that of `storage`. */
const SETTINGS: typeof SETTINGS_TABLE = "settings";

/**
 * The tables each Query of `time-tracking` reads, once for its Storage and for the story Port, so a
 * story reloads a Query after the same Table Changes the app does. `days` reads the Time Zone,
 * so a change of it reloads the week (D352).
 */
export const TIME_TRACKING_READS = {
  entry: ["time_entries", "projects"],
  days: ["time_entries", "projects", SETTINGS],
} as const;
