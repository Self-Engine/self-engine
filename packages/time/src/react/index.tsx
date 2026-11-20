import type { SettingsStore } from "@self-engine/settings";
import { useSetting } from "@self-engine/settings/react";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import type { FirstDayOfWeek, Region } from "../first-day-of-week.ts";
import {
  reportEachNameOnce,
  resolveTimeZoneSetting,
  resolveWeekStart,
  TIME_ZONE_SETTING,
  WEEK_START_SETTING,
} from "../settings/index.ts";
import type { TimeZone } from "../zone.ts";

export interface TimeSettingsProviderProps {
  /** Already loaded before the first render. */
  readonly store: SettingsStore;
  readonly deviceZone: TimeZone;
  /** The region of the active App Language. */
  readonly region: Region;
  readonly onError: (error: Error) => void;
  readonly children: ReactNode;
}

type TimeSettingsSources = Pick<TimeSettingsProviderProps, "store" | "deviceZone" | "region"> & {
  readonly reportUnknownZone: (name: string) => void;
};

const TimeSettings = createContext<TimeSettingsSources | null>(null);

/**
 * Supplies a page's time settings and reports each unknown stored name once while `onError` stays
 * the same function.
 */
export function TimeSettingsProvider({
  store,
  deviceZone,
  region,
  onError,
  children,
}: TimeSettingsProviderProps) {
  const reportUnknownZone = useMemo(
    () =>
      reportEachNameOnce((name) =>
        onError(new Error(`Unknown stored Time Zone: ${JSON.stringify(name)}`)),
      ),
    [onError],
  );
  const value = useMemo(
    () => ({ store, deviceZone, region, reportUnknownZone }),
    [store, deviceZone, region, reportUnknownZone],
  );
  return <TimeSettings value={value}>{children}</TimeSettings>;
}

function useTimeSettings(): TimeSettingsSources {
  const settings = useContext(TimeSettings);
  if (settings === null) throw new Error("Time Settings hooks require a TimeSettingsProvider");
  return settings;
}

/** The user's Time Zone, falling back to the device's zone. Follows the store. */
export function useTimeZone(): TimeZone {
  const { store, deviceZone, reportUnknownZone } = useTimeSettings();
  const name = useSetting(store, TIME_ZONE_SETTING);
  const resolved = useMemo(() => resolveTimeZoneSetting(name, deviceZone), [name, deviceZone]);
  const unknownName = resolved.fallback === "unknownName" ? resolved.name : undefined;
  useEffect(() => {
    if (unknownName !== undefined) reportUnknownZone(unknownName);
  }, [unknownName, reportUnknownZone]);
  return resolved.timeZone;
}

/** The first day of the week. Follows the store and, in automatic mode, the App Language. */
export function useFirstDayOfWeek(): FirstDayOfWeek {
  const { store, region } = useTimeSettings();
  return resolveWeekStart(useSetting(store, WEEK_START_SETTING), region);
}

export { PageClockProvider, type PageClockProviderProps, useNow, useToday } from "./page-clock.tsx";
export type { PageVisibility } from "./ticker.ts";
