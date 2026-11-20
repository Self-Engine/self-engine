import { createSettingsStore, type JsonValue } from "@self-engine/settings";
import { createTestAdapter, settle } from "@self-engine/settings/testing";
import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import {
  FOLLOW_DEVICE_ZONE_SETTING,
  TIME_ZONE_SETTING,
  ZONE_OFFER_DISMISSED_SETTING,
} from "@self-engine/time/settings";
import { expect, test } from "vite-plus/test";
import { watchDeviceZone } from "./device-zone.tsx";
import { followDeviceZone, type ZoneOffer } from "./follow-device-zone.ts";

const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BERLIN = zone("Europe/Berlin");
const BANGKOK = zone("Asia/Bangkok");
const KOLKATA = zone("Asia/Kolkata");

/** A page whose visibility the test sets, like the browser does when the window is hidden. */
function testPage() {
  const events = new EventTarget();
  const page = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const becomes = (state: DocumentVisibilityState) => {
    page.visibilityState = state;
    events.dispatchEvent(new Event("visibilitychange"));
  };
  return { page, becomes };
}

interface Stored {
  readonly synced?: Record<string, JsonValue>;
  readonly device?: Record<string, JsonValue>;
}

/** One window of the app: its store, its page and the offers it shows. */
async function openWindow(stored: Stored = {}, device = BANGKOK) {
  const adapters = {
    synced: createTestAdapter(stored.synced),
    device: createTestAdapter(stored.device),
  };
  const store = createSettingsStore({ adapters, onError: () => {} });
  await store.load();
  const { page, becomes } = testPage();
  let deviceZone = device;
  const shown: ZoneOffer[] = [];
  const open = new Set<ZoneOffer>();
  const switched: (readonly [string, TimeZone])[] = [];
  const stop = followDeviceZone({
    store,
    device: watchDeviceZone(page, () => deviceZone),
    showOffer: (offer) => {
      shown.push(offer);
      open.add(offer);
      return () => open.delete(offer);
    },
    onSwitched: (from, to) => switched.push([from, to]),
  });
  return {
    store,
    adapters,
    shown,
    open,
    switched,
    stop,
    becomes,
    /** The only offer on screen. */
    offer: () => {
      expect(open.size).toBe(1);
      return [...open][0]!;
    },
    /** The user closes the offer's Notice without answering it. */
    closeOffer: () => {
      const [offer] = open;
      open.clear();
      offer?.closed();
    },
    deviceMovesTo: (next: TimeZone) => {
      deviceZone = next;
    },
  };
}

const IN_BERLIN: Stored = { synced: { "time.zone": "Europe/Berlin" } };

test("a device in another zone offers the switch at the start, naming both zones", async () => {
  const app = await openWindow(IN_BERLIN);
  expect(app.offer()).toMatchObject({ stored: BERLIN, device: BANGKOK });
});

test("Switch stores the device's zone, closes the offer and reports the switch", async () => {
  const app = await openWindow(IN_BERLIN);
  app.offer().switchZone();
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.open.size).toBe(0);
  expect(app.switched).toEqual([[BERLIN, BANGKOK]]);
});

test("Don't ask again stores the Device Setting, and no offer comes back", async () => {
  const app = await openWindow(IN_BERLIN);
  app.offer().dismiss();
  await settle();
  expect(app.store.read(ZONE_OFFER_DISMISSED_SETTING)).toBe(true);
  expect(app.adapters.device.stored.get("time.zoneOfferDismissed")).toBe(true);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Europe/Berlin");
  expect(app.open.size).toBe(0);

  app.becomes("hidden");
  app.becomes("visible");
  expect(app.shown).toHaveLength(1);

  // The next start reads the same device storage.
  const next = await openWindow({
    ...IN_BERLIN,
    device: Object.fromEntries(app.adapters.device.stored),
  });
  expect(next.shown).toEqual([]);
});

test("with follow device on, the Setting takes the device's zone without an offer", async () => {
  const app = await openWindow({
    synced: { "time.zone": "Europe/Berlin", "time.followDevice": true },
  });
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.shown).toEqual([]);
  expect(app.switched).toEqual([]);
});

test("with the device in the stored zone, nothing appears, also under another name", async () => {
  expect((await openWindow({ synced: { "time.zone": "Asia/Bangkok" } })).shown).toEqual([]);
  expect((await openWindow({ synced: { "time.zone": "Asia/Calcutta" } }, KOLKATA)).shown).toEqual(
    [],
  );
});

test("an unset zone makes no offer and is left unset", async () => {
  const app = await openWindow();
  expect(app.shown).toEqual([]);
  expect(app.store.read(TIME_ZONE_SETTING)).toBeNull();
});

test("the decision runs again when the window becomes visible", async () => {
  const app = await openWindow({ synced: { "time.zone": "Asia/Bangkok" } });
  app.becomes("hidden");
  app.deviceMovesTo(BERLIN);
  expect(app.shown).toEqual([]);

  app.becomes("visible");
  expect(app.offer()).toMatchObject({ stored: BANGKOK, device: BERLIN });
});

test("becoming visible again does not show the same offer twice", async () => {
  const app = await openWindow(IN_BERLIN);
  app.becomes("hidden");
  app.becomes("visible");
  expect(app.shown).toHaveLength(1);
  expect(app.open.size).toBe(1);
});

test("an offer the device no longer stands behind is withdrawn when the window comes back", async () => {
  const app = await openWindow(IN_BERLIN);
  app.becomes("hidden");
  app.deviceMovesTo(BERLIN);
  app.becomes("visible");
  expect(app.open.size).toBe(0);
});

test("an offer closed without an answer comes back when the window becomes visible", async () => {
  const app = await openWindow(IN_BERLIN);
  app.closeOffer();
  expect(app.open.size).toBe(0);
  app.becomes("hidden");
  app.becomes("visible");
  expect(app.shown).toHaveLength(2);
});

test("the offer answered with Switch in one window disappears in the other", async () => {
  const first = await openWindow(IN_BERLIN);
  const second = await openWindow(IN_BERLIN);
  first.offer().switchZone();
  await settle();
  // What the other window's storage reports, as `localStorage` or the Data Process does.
  second.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Asia/Bangkok" }]);
  expect(second.open.size).toBe(0);
  expect(second.switched).toEqual([]);
});

test("the offer answered with Don't ask again in one window disappears in the other", async () => {
  const first = await openWindow(IN_BERLIN);
  const second = await openWindow(IN_BERLIN);
  first.offer().dismiss();
  second.adapters.device.changeFromOutside([{ key: "time.zoneOfferDismissed", value: true }]);
  expect(second.open.size).toBe(0);
});

test("follow device turned on in another window takes the zone where an offer was open", async () => {
  const app = await openWindow(IN_BERLIN);
  app.adapters.synced.changeFromOutside([{ key: "time.followDevice", value: true }]);
  expect(app.open.size).toBe(0);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.store.read(FOLLOW_DEVICE_ZONE_SETTING)).toBe(true);
});

test("a write to another Setting leaves an open offer as it is", async () => {
  const app = await openWindow(IN_BERLIN);
  app.adapters.synced.changeFromOutside([{ key: "time.weekStart", value: "sunday" }]);
  expect(app.shown).toHaveLength(1);
  expect(app.open.size).toBe(1);
});

test("nothing is offered after the watching has stopped, and an open offer is withdrawn", async () => {
  const app = await openWindow(IN_BERLIN);
  app.stop();
  expect(app.open.size).toBe(0);
  app.becomes("hidden");
  app.becomes("visible");
  app.adapters.synced.changeFromOutside([{ key: "time.followDevice", value: true }]);
  expect(app.shown).toHaveLength(1);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Europe/Berlin");
});

test("follow device turned on here takes the device's zone at once, with no offer open", async () => {
  const app = await openWindow({ ...IN_BERLIN, device: { "time.zoneOfferDismissed": true } });
  expect(app.shown).toEqual([]);
  app.store.write(FOLLOW_DEVICE_ZONE_SETTING, true);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.shown).toEqual([]);
});

test("follow device turned on after an offer was closed takes the device's zone", async () => {
  const app = await openWindow(IN_BERLIN);
  app.closeOffer();
  app.store.write(FOLLOW_DEVICE_ZONE_SETTING, true);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.shown).toHaveLength(1);
});

test("a zone that arrives after the start, from the database, decides again", async () => {
  const app = await openWindow();
  expect(app.shown).toEqual([]);
  app.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Europe/Berlin" }]);
  expect(app.offer()).toMatchObject({ stored: BERLIN, device: BANGKOK });
});

test("a zone that arrives after the start with follow device on is followed", async () => {
  const app = await openWindow({ synced: { "time.followDevice": true } });
  app.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Europe/Berlin" }]);
  expect(app.store.read(TIME_ZONE_SETTING)).toBe("Asia/Bangkok");
  expect(app.shown).toEqual([]);
});

test("an offer closed without an answer stays closed when only the stored name's spelling changes", async () => {
  const app = await openWindow({ synced: { "time.zone": "Asia/Calcutta" } });
  app.closeOffer();
  app.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Asia/Kolkata" }]);
  expect(app.shown).toHaveLength(1);
  expect(app.open.size).toBe(0);
});

test("an offer closed without an answer gives way to the offer of another stored zone", async () => {
  const app = await openWindow(IN_BERLIN);
  app.closeOffer();
  app.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Europe/Paris" }]);
  expect(app.offer()).toMatchObject({ stored: zone("Europe/Paris"), device: BANGKOK });
});

test("another window rewriting the stored name to another spelling keeps the open offer", async () => {
  const app = await openWindow({ synced: { "time.zone": "Asia/Calcutta" } });
  app.adapters.synced.changeFromOutside([{ key: "time.zone", value: "Asia/Kolkata" }]);
  expect(app.shown).toHaveLength(1);
  expect(app.open.size).toBe(1);
});

test("the device reporting its zone under another name keeps the open offer", async () => {
  const app = await openWindow({ synced: { "time.zone": "Europe/Berlin" } }, zone("Asia/Calcutta"));
  app.becomes("hidden");
  app.deviceMovesTo(KOLKATA);
  app.becomes("visible");
  expect(app.shown).toHaveLength(1);
  expect(app.open.size).toBe(1);
});

test("Switch reports the stored name exactly as it was stored, for Undo", async () => {
  const app = await openWindow({ synced: { "time.zone": "europe/berlin" } });
  expect(app.offer()).toMatchObject({ stored: BERLIN, device: BANGKOK });
  app.offer().switchZone();
  expect(app.switched).toEqual([["europe/berlin", BANGKOK]]);
});
