// The offer to switch to the device's Time Zone (D147), without React, so that its flow is tested
// on a store, a page and a device zone of the test's own. The decision is `time`'s; this file says
// when it runs and what its answer writes.

import type { SettingsStore } from "@self-engine/settings";
import type { TimeZone } from "@self-engine/time";
import type { DeviceZoneSource } from "./device-zone.tsx";
import {
  decideZoneOffer,
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  sameTimeZone,
  ZONE_OFFER_DISMISSED_SETTING,
} from "@self-engine/time/settings";

/** The offer on screen: both zones, and what each answer does. */
export interface ZoneOffer {
  /** The stored Time Zone, resolved: for display and comparison. */
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
  /** The device's zone, read again whenever the window becomes visible (`watchDeviceZone`). */
  readonly device: DeviceZoneSource;
  /** Shows the offer until an answer or the returned function closes it. */
  readonly showOffer: (offer: ZoneOffer) => () => void;
  /**
   * "Switch" stored `to` in place of `from`: the Setting's value exactly as it was stored, so that
   * writing it back restores the chosen spelling (D282).
   */
  readonly onSwitched: (from: string, to: TimeZone) => void;
}

/** The zones of an offer, to tell whether a new decision is the same offer. */
interface OfferZones {
  readonly stored: TimeZone;
  readonly device: TimeZone;
}

function sameOffer(a: OfferZones | undefined, b: OfferZones): boolean {
  return a !== undefined && sameTimeZone(a.stored, b.stored) && sameTimeZone(a.device, b.device);
}

/**
 * Decides at once, whenever the window becomes visible again, and whenever one of the decision's
 * inputs changes in the store (the stored zone, follow device, dismissed), here or in another
 * window, until the returned function is called. A change of another Setting decides nothing. An
 * offer closed without an answer comes back only when the window becomes visible again. Nothing
 * runs per render or on a timer.
 */
export function followDeviceZone({
  store,
  device: deviceZone,
  showOffer,
  onSwitched,
}: DeviceZoneWatch): () => void {
  let open: (OfferZones & { readonly close: () => void }) | undefined;
  // The offer closed without an answer: it stays away until the window becomes visible again.
  let closed: OfferZones | undefined;
  // The device's zone as the source last read it: at the start and when the window became visible.
  let device = deviceZone.current();
  let inputs = readInputs();

  function readInputs() {
    return {
      stored: store.read(TIME_ZONE_SETTING),
      followDevice: store.read(FOLLOW_DEVICE_ZONE_SETTING),
      dismissed: store.read(ZONE_OFFER_DISMISSED_SETTING),
    };
  }

  function closeOffer(): void {
    open?.close();
    open = undefined;
  }

  function decide(): void {
    const decision = decideZoneOffer({ ...inputs, device });
    if (decision.kind === "offer" && sameOffer(open, decision)) return;
    closeOffer();
    if (decision.kind === "follow") store.write(TIME_ZONE_SETTING, decision.device);
    if (decision.kind !== "offer" || sameOffer(closed, decision)) return;
    closed = undefined;
    const { storedName } = decision;
    const zones: OfferZones = { stored: decision.stored, device: decision.device };
    const hide = showOffer({
      ...zones,
      switchZone: () => {
        store.write(TIME_ZONE_SETTING, zones.device);
        onSwitched(storedName, zones.device);
      },
      dismiss: () => store.write(ZONE_OFFER_DISMISSED_SETTING, true),
      closed: () => {
        if (open === undefined || !sameOffer(open, zones)) return;
        closeOffer();
        closed = zones;
      },
    });
    open = { ...zones, close: hide };
  }

  const unsubscribe = store.subscribe(() => {
    const next = readInputs();
    if (
      next.stored === inputs.stored &&
      next.followDevice === inputs.followDevice &&
      next.dismissed === inputs.dismissed
    )
      return;
    inputs = next;
    decide();
  });
  const stopVisible = deviceZone.onVisible(() => {
    device = deviceZone.current();
    closed = undefined;
    decide();
  });
  decide();
  return () => {
    unsubscribe();
    stopVisible();
    closeOffer();
  };
}
