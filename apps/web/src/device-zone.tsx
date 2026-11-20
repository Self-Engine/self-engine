// The zone the device runs in, for the whole page: read at the start, again whenever the window
// becomes visible, and before the offer writes it, so that the offer of the device's zone and the
// page's Time Zone see the same one.

import type { TimeZone } from "@self-engine/time";
import { sameTimeZone } from "@self-engine/time/settings";
import { TimeSettingsProvider, type TimeSettingsProviderProps } from "@self-engine/time/react";
import { useSyncExternalStore } from "react";

/** Where the window says that it became visible: the document, in the app. */
export type VisibilityPage = Pick<Document, "visibilityState"> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

type Listen = (listener: () => void) => () => void;

export interface DeviceZoneSource {
  /** The zone the device runs in, as last read. */
  readonly current: () => TimeZone;
  /**
   * Reads the zone again now and answers with it. For a reader about to write the zone at a
   * moment the window did not just become visible: a window that stayed hidden, or stayed open
   * beside another, may hold a zone the device has left.
   */
  readonly refresh: () => TimeZone;
  /** Calls `listener` each time a read found another zone. Returns the function that stops it. */
  readonly onChange: Listen;
  /**
   * Calls `listener` each time the window becomes visible, after the zone was read again.
   * Returns the function that stops it.
   */
  readonly onVisible: Listen;
}

function listeners(): { readonly listen: Listen; readonly call: () => void } {
  const entries = new Set<() => void>();
  return {
    listen: (listener) => {
      // A wrapper per call, so the same function added twice stops one at a time.
      const entry = () => listener();
      entries.add(entry);
      return () => entries.delete(entry);
    },
    call: () => {
      for (const entry of entries) entry();
    },
  };
}

/**
 * Reads the device's zone now, whenever the window becomes visible and whenever a reader asks,
 * for the lifetime of the page. Another name of the zone it holds keeps the name it holds, so a
 * reader renders again only when the zone really changed.
 */
export function watchDeviceZone(page: VisibilityPage, read: () => TimeZone): DeviceZoneSource {
  let current = read();
  const changed = listeners();
  const visible = listeners();
  function refresh(): TimeZone {
    const next = read();
    if (sameTimeZone(next, current)) return current;
    current = next;
    changed.call();
    return current;
  }
  page.addEventListener("visibilitychange", () => {
    if (page.visibilityState !== "visible") return;
    refresh();
    visible.call();
  });
  return {
    current: () => current,
    refresh,
    onChange: changed.listen,
    onVisible: visible.listen,
  };
}

export interface PageTimeSettingsProps extends Omit<TimeSettingsProviderProps, "deviceZone"> {
  readonly deviceZone: DeviceZoneSource;
}

/** `TimeSettingsProvider` with the device's zone of `watchDeviceZone`, following it. */
export function PageTimeSettings({ deviceZone, ...props }: PageTimeSettingsProps) {
  const zone = useSyncExternalStore(deviceZone.onChange, deviceZone.current);
  return <TimeSettingsProvider {...props} deviceZone={zone} />;
}
