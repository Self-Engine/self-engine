import type { SettingsStore } from "@self-engine/settings";
import { useSetting } from "@self-engine/settings/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { FirstDayOfWeek, Region } from "../first-day-of-week.ts";
import {
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

/** Supplies a page's time settings and remembers the unknown names reported during its lifetime. */
export function TimeSettingsProvider({
  store,
  deviceZone,
  region,
  onError,
  children,
}: TimeSettingsProviderProps) {
  const reportedNames = useRef(new Set<string>());
  const reportUnknownZone = useCallback(
    (name: string) => {
      if (reportedNames.current.has(name)) return;
      reportedNames.current.add(name);
      onError(new Error(`Unknown stored Time Zone: ${JSON.stringify(name)}`));
    },
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
  const { timeZone, fallback } = useMemo(
    () => resolveTimeZoneSetting(name, deviceZone),
    [name, deviceZone],
  );
  useEffect(() => {
    if (fallback === "unknownName" && name !== null) reportUnknownZone(name);
  }, [fallback, name, reportUnknownZone]);
  return timeZone;
}

/** The first day of the week. Follows the store and, in automatic mode, the App Language. */
export function useFirstDayOfWeek(): FirstDayOfWeek {
  const { store, region } = useTimeSettings();
  return resolveWeekStart(useSetting(store, WEEK_START_SETTING), region);
}
