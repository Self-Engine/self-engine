// The Synced Settings the app's Data Process writes at its start where their rows are missing
// (D353), through the start values of the core. A stored value is never overwritten.

import {
  startSetting,
  type DataProcessSources,
  type StartSetting,
} from "@self-engine/data-process";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";

/** The Time Zone comes from the device at the first start; after that only the user changes it. */
export function startSettings({
  deviceZone,
}: Pick<DataProcessSources, "deviceZone">): readonly StartSetting[] {
  return [startSetting(TIME_ZONE_SETTING, deviceZone())];
}
