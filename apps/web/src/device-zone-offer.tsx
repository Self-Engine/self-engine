// The Notice that offers the device's Time Zone (D147), and what the app does after "Switch".
// When it runs and what each answer writes is `followDeviceZone`'s.

import { Trans } from "@lingui/react/macro";
import type { SettingsStore } from "@self-engine/settings";
import type { TimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { notifyChoice, notifyUndoable } from "@self-engine/ui";
import { useEffect } from "react";
import { type DeviceZoneWatch, followDeviceZone, type ZoneOffer } from "./follow-device-zone.ts";

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
  /** The zone the device runs in now: `deviceTimeZone` of `time` in the app. */
  readonly deviceZone: () => TimeZone;
  /** Where the window says that it became visible; the document unless a story hands in its own. */
  readonly page?: DeviceZoneWatch["page"];
}

/**
 * Offers to switch to the device's zone at the start and whenever the window becomes visible
 * again (`followDeviceZone`). After "Switch", a Notice confirms the new zone and offers to take
 * it back. Renders nothing; it sits inside `FeedbackHost` and the App Language.
 */
export function DeviceZoneOffer({ store, deviceZone, page = document }: DeviceZoneOfferProps) {
  useEffect(
    () =>
      followDeviceZone({
        store,
        deviceZone,
        page,
        showOffer: showZoneOffer,
        onSwitched: (from, to) =>
          notifyUndoable({
            message: <Trans>The time zone is now {to}.</Trans>,
            undo: () => store.write(TIME_ZONE_SETTING, from),
          }),
      }),
    [store, deviceZone, page],
  );
  return null;
}
