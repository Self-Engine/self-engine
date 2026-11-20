// The zone the device runs in, for the whole page: read at the start and again whenever the window
// becomes visible, so that the offer of the device's zone and the page's Time Zone see the same one.

import type { TimeZone } from "@self-engine/time";
import { sameTimeZone } from "@self-engine/time/settings";
import { TimeSettingsProvider, type TimeSettingsProviderProps } from "@self-engine/time/react";
import { useSyncExternalStore } from "react";

/** Where the window says that it became visible: the document, in the app. */
export type VisibilityPage = Pick<Document, "visibilityState"> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

export interface DeviceZoneSource {
  /** The zone the device runs in, as last read. */
  readonly current: () => TimeZone;
  /**
   * Calls `listener` each time the window becomes visible, after the zone was read again.
   * Returns the function that stops it.
   */
  readonly onVisible: (listener: () => void) => () => void;
}

/**
 * Reads the device's zone now and whenever the window becomes visible, for the lifetime of the
 * page. Another name of the zone it holds keeps the name it holds, so a reader renders again only
 * when the zone really changed.
 */
export function watchDeviceZone(page: VisibilityPage, read: () => TimeZone): DeviceZoneSource {
  let current = read();
  const listeners = new Set<() => void>();
  page.addEventListener("visibilitychange", () => {
    if (page.visibilityState !== "visible") return;
    const next = read();
    if (!sameTimeZone(next, current)) current = next;
    for (const listener of listeners) listener();
  });
  return {
    current: () => current,
    onVisible: (listener) => {
      // A wrapper per call, so the same function added twice stops one at a time.
      const entry = () => listener();
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
  };
}

export interface PageTimeSettingsProps extends Omit<TimeSettingsProviderProps, "deviceZone"> {
  readonly deviceZone: DeviceZoneSource;
}

/** `TimeSettingsProvider` with the device's zone of `watchDeviceZone`, following it. */
export function PageTimeSettings({ deviceZone, ...props }: PageTimeSettingsProps) {
  const zone = useSyncExternalStore(deviceZone.onVisible, deviceZone.current);
  return <TimeSettingsProvider {...props} deviceZone={zone} />;
}
