// @vitest-environment happy-dom

import {
  activateLanguage,
  createI18n,
  type Language,
  regionForAppLanguage,
} from "@self-engine/i18n";
import { APP_LANGUAGE_SETTING } from "@self-engine/settings-area/settings";
import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { resolveTimeZone } from "@self-engine/time";
import { TimeSettingsProvider, useFirstDayOfWeek, useTimeZone } from "@self-engine/time/react";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import { act, createElement, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { AppLanguage } from "./app-language.tsx";

const DEVICE_ZONE = resolveTimeZone("America/New_York").timeZone;

function RegionReadout() {
  return createElement("p", null, useTimeZone(), " / ", useFirstDayOfWeek());
}

async function settings() {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
  return store;
}

function page() {
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  return {
    draw: (view: ReactNode) => act(() => root.render(createElement(StrictMode, null, view))),
    text: () => container.textContent,
  };
}

let cleanup: (() => void) | undefined;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
});

test("a View reads the fixed Time Zone and first day of the week and follows writes", async () => {
  const store = await settings();
  store.write(TIME_ZONE_SETTING, "Europe/Berlin");
  store.write(WEEK_START_SETTING, "saturday");

  const view = page();
  view.draw(
    createElement(TimeSettingsProvider, {
      store,
      deviceZone: DEVICE_ZONE,
      region: "en-US",
      onError: vi.fn(),
      children: createElement(RegionReadout),
    }),
  );

  expect(view.text()).toBe("Europe/Berlin / saturday");

  act(() => store.write(TIME_ZONE_SETTING, "Asia/Bangkok"));
  expect(view.text()).toBe("Asia/Bangkok / saturday");

  act(() => store.write(WEEK_START_SETTING, "monday"));
  expect(view.text()).toBe("Asia/Bangkok / monday");
});

test("changing the App Language moves an automatic week start", async () => {
  const store = await settings();
  store.write(APP_LANGUAGE_SETTING, "de");
  const i18n = createI18n();
  const loadCatalog = async () => ({});
  await activateLanguage(i18n, "de", loadCatalog);
  const view = page();
  view.draw(
    createElement(AppLanguage, {
      i18n,
      initialLanguage: "de",
      store,
      loadCatalog,
      children: (language: Language) =>
        createElement(TimeSettingsProvider, {
          store,
          deviceZone: DEVICE_ZONE,
          region: regionForAppLanguage(language),
          onError: vi.fn(),
          children: createElement(RegionReadout),
        }),
    }),
  );
  expect(view.text()).toBe("America/New_York / monday");

  await act(async () => store.write(APP_LANGUAGE_SETTING, "en"));

  expect(view.text()).toBe("America/New_York / sunday");
});

test("an unknown Time Zone falls back and is reported once per name across Views", async () => {
  const store = await settings();
  const view = page();
  const onError = vi.fn<(error: Error) => void>();
  const draw = (children: ReactNode) =>
    view.draw(
      createElement(TimeSettingsProvider, {
        store,
        deviceZone: DEVICE_ZONE,
        region: "en-US",
        onError,
        children,
      }),
    );

  draw(createElement(RegionReadout));
  expect(view.text()).toBe("America/New_York / sunday");
  expect(onError).not.toHaveBeenCalled();

  act(() => store.write(TIME_ZONE_SETTING, "Future/City"));
  expect(view.text()).toBe("America/New_York / sunday");
  expect(onError).toHaveBeenCalledExactlyOnceWith(
    new Error('Unknown stored Time Zone: "Future/City"'),
  );

  draw(null);
  draw(createElement(RegionReadout));
  act(() => store.write(TIME_ZONE_SETTING, "Future/Other"));
  act(() => store.write(TIME_ZONE_SETTING, "Future/City"));

  expect(onError.mock.calls.map(([error]) => error.message)).toEqual([
    'Unknown stored Time Zone: "Future/City"',
    'Unknown stored Time Zone: "Future/Other"',
  ]);
  expect(store.read(TIME_ZONE_SETTING)).toBe("Future/City");
});
