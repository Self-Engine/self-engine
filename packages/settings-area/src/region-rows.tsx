// The rows of the region on the View "Language and region" (D197): the Time Zone, "follow device"
// and the week start. Their Settings are declared by `time`, which owns both values (D356).

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Select } from "@mantine/core";
import { useSetting } from "@self-engine/settings/react";
import type { Clock } from "@self-engine/time";
import { useTimeZone } from "@self-engine/time/react";
import {
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  type WeekStart,
  WEEK_START_SETTING,
} from "@self-engine/time/settings";
import { timeZoneChoices, timeZonePlaces } from "@self-engine/time/zone-list";
import { useMemo, useState } from "react";
import type { SettingsRow, SettingsRowControlProps } from "./row.ts";
import { choiceRow, switchRow } from "./standard-rows.tsx";
import type { LocalText } from "./text.ts";
import { VIEW_IDS } from "./views.ts";

/** The text a zone is shown and searched by: its place and its offset now. */
const zoneLabel = (choice: { readonly place: string; readonly offset: string }) =>
  `${choice.place} (${choice.offset})`;

/**
 * The places of all zones, so that "Berlin" finds the row. Names of the runtime, the same in every
 * language (D282), worked out when the search first reads the row.
 */
const ZONE_PLACES: LocalText = () => timeZonePlaces().join("\n");

function timeZoneRow(clock: Clock): SettingsRow {
  function TimeZoneControl({ store, labelledBy }: SettingsRowControlProps) {
    const { t } = useLingui();
    // The zone the app computes with: the stored one, or the device's while none is set.
    const shown = useTimeZone();
    const followsDevice = useSetting(store, FOLLOW_DEVICE_ZONE_SETTING);
    // The offsets of the moment the row was first shown: they change at most twice a year.
    const [now] = useState(clock);
    // About 0.5–0.6 ms for some 420 zones in Chromium (about 2 ms in Node); opening the list draws
    // them all in about 50 ms (#364), so Mantine's Select needs no limit.
    const data = useMemo(
      () =>
        timeZoneChoices(now, shown).map((choice) => ({
          value: choice.timeZone,
          label: zoneLabel(choice),
        })),
      [now, shown],
    );
    return (
      <Select
        allowDeselect={false}
        aria-labelledby={labelledBy}
        data={data}
        disabled={followsDevice}
        flex="0 1 18rem"
        nothingFoundMessage={t`No Time Zone found`}
        onChange={(name) => {
          if (name !== null) store.write(TIME_ZONE_SETTING, name);
        }}
        searchable
        value={shown}
      />
    );
  }
  return {
    id: "time-zone",
    view: VIEW_IDS.language,
    title: msg`Time Zone`,
    description: msg`The zone in which the app counts days and shows times.`,
    searchWords: [msg`Region`, msg`Clock`, ZONE_PLACES],
    values: [],
    settings: [TIME_ZONE_SETTING.key],
    control: TimeZoneControl,
  };
}

const FOLLOW_DEVICE_ROW = switchRow({
  id: "follow-device-zone",
  view: VIEW_IDS.language,
  title: msg`Follow Device`,
  description: msg`Switch the Time Zone to the zone of this device whenever the device changes zones, without asking.`,
  searchWords: [msg`Travel`, msg`Automatic Time Zone`],
  setting: FOLLOW_DEVICE_ZONE_SETTING,
});

const day = {
  monday: msg`Monday`,
  tuesday: msg`Tuesday`,
  wednesday: msg`Wednesday`,
  thursday: msg`Thursday`,
  friday: msg`Friday`,
  saturday: msg`Saturday`,
  sunday: msg`Sunday`,
} as const;

/** The days the row offers; the others show only while one of them is stored. */
const OFFERED_DAYS = ["monday", "sunday", "saturday"] as const;
const OTHER_DAYS = ["tuesday", "wednesday", "thursday", "friday"] as const;

const WEEK_START_ROW = choiceRow<WeekStart>({
  id: "week-start",
  view: VIEW_IDS.language,
  title: msg`Week Start`,
  description: msg`The first day of each week. "Automatic" follows the region of the App Language.`,
  searchWords: [msg`Calendar week`, msg`First weekday`],
  setting: WEEK_START_SETTING,
  choices: [
    { value: "automatic", label: msg({ message: "Automatic", context: "Week Start" }) },
    ...OFFERED_DAYS.map((value) => ({ value, label: day[value] })),
  ],
  shownWhenStored: OTHER_DAYS.map((value) => ({ value, label: day[value] })),
});

/** The rows of the region, in the order they are shown below the App Language. */
export function regionRows(clock: Clock): readonly SettingsRow[] {
  return [timeZoneRow(clock), FOLLOW_DEVICE_ROW, WEEK_START_ROW];
}
