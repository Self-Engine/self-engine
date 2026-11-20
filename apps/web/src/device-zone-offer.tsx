// The Notice that offers the device's Time Zone (D147), and what the app does after "Switch".
// When it runs and what each answer writes is `followDeviceZone`'s.

import { Trans } from "@lingui/react/macro";
import type { SettingsStore } from "@self-engine/settings";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { notifyChoice, notifyUndoable } from "@self-engine/ui";
import { useEffect } from "react";
import type { DeviceZoneSource } from "./device-zone.tsx";
import { followDeviceZone, type ZoneOffer } from "./follow-device-zone.ts";

/** Shows the offer with both zones named. Its texts follow a switch of the App Language. */
function showZoneOffer({ stored, device, switchZone, dismiss, closed }: ZoneOffer): () => void {
  return notifyChoice({
    message: (
      <Trans>
        This device is in the time zone {device}. Switch from {stored} to {device}?
      </Trans>
    ),
    actions: [
      { label: <Trans context="Time zone">Switch</Trans>, run: switchZone },
      { label: <Trans>Don't ask again</Trans>, run: dismiss },
    ],
    onClosed: closed,
  });
}

export interface DeviceZoneOfferProps {
  /** The store whose Time Zone the offer reads and writes, already loaded. */
  readonly store: SettingsStore;
  /** The device's zone, the same source the page's Time Zone reads (`watchDeviceZone`). */
  readonly device: DeviceZoneSource;
}

/**
 * Offers to switch to the device's zone at the start and whenever the window becomes visible
 * again (`followDeviceZone`). After "Switch", a Notice confirms the new zone and offers to take
 * it back: "Undo" writes the stored name exactly as it was stored, its spelling included (D282). Renders nothing; it sits inside `FeedbackHost` and the App Language.
 */
export function DeviceZoneOffer({ store, device }: DeviceZoneOfferProps) {
  useEffect(
    () =>
      followDeviceZone({
        store,
        device,
        showOffer: showZoneOffer,
        onSwitched: (from, to) =>
          notifyUndoable({
            message: <Trans>The time zone is now {to}.</Trans>,
            undo: () => store.write(TIME_ZONE_SETTING, from),
          }),
      }),
    [store, device],
  );
  return null;
}
