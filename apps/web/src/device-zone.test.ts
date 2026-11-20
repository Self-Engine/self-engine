// @vitest-environment happy-dom

import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import { useTimeZone } from "@self-engine/time/react";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { PageTimeSettings, watchDeviceZone } from "./device-zone.tsx";
import { watchVisibility } from "./page-visibility.ts";

const zone = (name: string): TimeZone => resolveTimeZone(name).timeZone;
const BERLIN = zone("Europe/Berlin");
const BANGKOK = zone("Asia/Bangkok");

/** A page whose visibility the test sets, and a device whose zone it moves. */
function testDevice(start: TimeZone) {
  const events = new EventTarget();
  let current = start;
  const page = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return {
    page,
    read: () => current,
    moveTo: (next: TimeZone) => {
      current = next;
    },
    becomes: (state: DocumentVisibilityState) => {
      page.visibilityState = state;
      events.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

test("the device's zone is read at the start and again when the window becomes visible", () => {
  const device = testDevice(BERLIN);
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  const visible = vi.fn(() => source.current());
  source.onVisible(visible);
  expect(source.current()).toBe(BERLIN);

  device.moveTo(BANGKOK);
  device.becomes("hidden");
  expect(source.current()).toBe(BERLIN);
  expect(visible).not.toHaveBeenCalled();

  device.becomes("visible");
  expect(source.current()).toBe(BANGKOK);
  // A listener already sees the new zone.
  expect(visible).toHaveLastReturnedWith(BANGKOK);
});

test("another name of the same zone keeps the zone as it was read", () => {
  const device = testDevice(zone("Asia/Calcutta"));
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  device.moveTo(zone("Asia/Kolkata"));
  device.becomes("visible");
  expect(source.current()).toBe("Asia/Calcutta");
});

test("a listener that stopped hears nothing more", () => {
  const device = testDevice(BERLIN);
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  const visible = vi.fn();
  const changed = vi.fn();
  source.onVisible(visible)();
  source.onChange(changed)();
  device.moveTo(BANGKOK);
  device.becomes("visible");
  expect(visible).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
});

test("a reader that asks gets the zone the device is in now, without a window event", () => {
  const device = testDevice(BERLIN);
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  const changed = vi.fn(() => source.current());
  const visible = vi.fn();
  source.onChange(changed);
  source.onVisible(visible);

  device.moveTo(BANGKOK);
  expect(source.current()).toBe(BERLIN);
  expect(source.refresh()).toBe(BANGKOK);
  expect(source.current()).toBe(BANGKOK);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed).toHaveLastReturnedWith(BANGKOK);
  expect(visible).not.toHaveBeenCalled();
});

test("a read that finds the same zone tells no one of a change", () => {
  const device = testDevice(zone("Asia/Calcutta"));
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  const changed = vi.fn();
  source.onChange(changed);
  device.moveTo(zone("Asia/Kolkata"));
  expect(source.refresh()).toBe("Asia/Calcutta");
  device.becomes("visible");
  expect(changed).not.toHaveBeenCalled();
});

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

test("the page's Time Zone follows the device when the window becomes visible", async () => {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
  const device = testDevice(BERLIN);
  const source = watchDeviceZone(watchVisibility(device.page), device.read);
  let renders = 0;
  function Readout() {
    renders += 1;
    return createElement("p", null, useTimeZone());
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(PageTimeSettings, {
          store,
          deviceZone: source,
          region: "de-DE",
          onError: vi.fn(),
          children: createElement(Readout),
        }),
      ),
    ),
  );
  expect(container.textContent).toBe("Europe/Berlin");
  const drawn = renders;

  act(() => device.becomes("visible"));
  expect(renders).toBe(drawn);

  device.moveTo(BANGKOK);
  act(() => device.becomes("visible"));
  expect(container.textContent).toBe("Asia/Bangkok");
  act(() => root.unmount());
});
