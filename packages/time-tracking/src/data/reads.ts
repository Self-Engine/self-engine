// No runtime import: the story Port loads this file, and the storage code must not load with it.
import type { SETTINGS_TABLE } from "@self-engine/storage";

/** The Settings table: the Time Zone is a Setting. The type keeps the name that of `storage`. */
const SETTINGS: typeof SETTINGS_TABLE = "settings";

/**
 * The tables each Query of `time-tracking` reads, once for its Storage and for the story Port, so a
 * story reloads a Query after the same Table Changes the app does. `days` reads the Time Zone,
 * so a change of it reloads the week (D352). The shares of an entry are Part Rows of it (ADR
 * 0042), so a Query that reads them names `time_entries` too.
 */
export const TIME_TRACKING_READS = {
  entry: ["time_entries", "project_shares", "projects"],
  days: ["time_entries", "project_shares", "projects", SETTINGS],
  runningTimers: ["timers", "projects"],
} as const;
