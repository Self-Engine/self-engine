// The audit of the real list of Settings Rows (ADR 0016), as an entry of its own: the app runs it
// over its real contributions, and the list stays out of the startup bundle.

import { auditSettingsRows } from "./audit-rows.ts";
import { type SettingsRowSources, settingsRows } from "./rows.tsx";
import {
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  WEEK_START_SETTING,
} from "@self-engine/time/settings";
import { APP_LANGUAGE_SETTING, APPEARANCE_SETTINGS } from "./settings.ts";

/** The keys of the Settings the area has to show. */
const SERVED_SETTINGS = [
  ...Object.values(APPEARANCE_SETTINGS).map((setting) => setting.key),
  APP_LANGUAGE_SETTING.key,
  TIME_ZONE_SETTING.key,
  FOLLOW_DEVICE_ZONE_SETTING.key,
  WEEK_START_SETTING.key,
];

/**
 * What is wrong with the list the area builds from `sources` for these Views; empty when it is
 * sound: a row id used twice, a row of a View the area lacks, a View without a row, or a Setting
 * the area has to show that no row serves.
 */
export function auditSettingsArea(
  views: readonly { readonly id: string }[],
  sources: Omit<SettingsRowSources, "clock">,
): string[] {
  return auditSettingsRows(settingsRows({ ...sources, clock: NO_CLOCK }), views, SERVED_SETTINGS);
}

/** The audit reads the rows and draws none, so nothing asks for "now". */
function NO_CLOCK(): never {
  throw new Error("The audit of the Settings Rows draws no row and has no clock");
}
