// The offer to switch to the device's Time Zone (D147), without React, so that its flow is tested
// on a store, a page and a device zone of the test's own. The decision is `time`'s; this file says
// when it runs and what its answer writes.

import type { SettingsStore } from "@self-engine/settings";
import type { TimeZone } from "@self-engine/time";
import {
  decideZoneOffer,
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  ZONE_OFFER_DISMISSED_SETTING,
} from "@self-engine/time/settings";

/** The offer on screen: both zones, and what each answer does. */
export interface ZoneOffer {
  /** The stored Time Zone, as it was chosen. */
  readonly stored: TimeZone;
  /** The zone the device runs in. */
  readonly device: TimeZone;
  /** Stores the device's zone as the Time Zone. */
  readonly switchZone: () => void;
  /** Stores on this device that it no longer offers its zone. */
  readonly dismiss: () => void;
  /** The offer closed without an answer; it comes again when the window becomes visible. */
  readonly closed: () => void;
}

export interface DeviceZoneWatch {
  readonly store: SettingsStore;
  /** The zone the device runs in now: `deviceTimeZone` of `time` in the app. */
  readonly deviceZone: () => TimeZone;
  /** Where the window says that it became visible: the document, in the app. */
  readonly page: Pick<Document, "visibilityState"> &
    Pick<EventTarget, "addEventListener" | "removeEventListener">;
  /** Shows the offer until an answer or the returned function closes it. */
  readonly showOffer: (offer: ZoneOffer) => () => void;
  /** "Switch" stored `to` in place of `from`. */
  readonly onSwitched: (from: TimeZone, to: TimeZone) => void;
}

/**
 * Decides at once and whenever the window becomes visible again, until the returned function is
 * called. While an offer is open, a change of the store decides again, so an offer answered in
 * another window disappears here. Nothing runs per render or on a timer.
 */
export function followDeviceZone({
  store,
  deviceZone,
  page,
  showOffer,
  onSwitched,
}: DeviceZoneWatch): () => void {
  let open: { readonly stored: TimeZone; readonly device: TimeZone; readonly close: () => void } | undefined;

  function closeOffer(): void {
    open?.close();
    open = undefined;
  }

  function decide(device: TimeZone): void {
    const decision = decideZoneOffer({
      stored: store.read(TIME_ZONE_SETTING),
      device,
      followDevice: store.read(FOLLOW_DEVICE_ZONE_SETTING),
      dismissed: store.read(ZONE_OFFER_DISMISSED_SETTING),
    });
    if (decision.kind === "offer" && open?.stored === decision.stored && open.device === device)
      return;
    closeOffer();
    if (decision.kind === "follow") store.write(TIME_ZONE_SETTING, decision.device);
    if (decision.kind !== "offer") return;
    const { stored } = decision;
    // Only while an offer is open does a write, here or in another window, decide again.
    const unsubscribe = store.subscribe(() => decide(device));
    const hide = showOffer({
      stored,
      device,
      switchZone: () => {
        store.write(TIME_ZONE_SETTING, device);
        onSwitched(stored, device);
      },
      dismiss: () => store.write(ZONE_OFFER_DISMISSED_SETTING, true),
      closed: () => {
        if (open?.stored === stored && open.device === device) closeOffer();
      },
    });
    open = {
      stored,
      device,
      close: () => {
        unsubscribe();
        hide();
      },
    };
  }

  const onVisibility = () => {
    if (page.visibilityState === "visible") decide(deviceZone());
  };
  page.addEventListener("visibilitychange", onVisibility);
  decide(deviceZone());
  return () => {
    page.removeEventListener("visibilitychange", onVisibility);
    closeOffer();
  };
}
