import type { LocalSettingsStorage } from "@self-engine/settings";
import { APPEARANCE_SETTINGS, appLanguageOf } from "@self-engine/settings-area/settings";
import type { SettingsPortConnection } from "@self-engine/settings-data/adapter";
import { settle } from "@self-engine/settings/testing";
import { expect, it, vi } from "vite-plus/test";
import { createAppSettingsStore } from "./app-settings.ts";

const { accent, colorMode, lightTheme } = APPEARANCE_SETTINGS;

const ACCENT_ITEM = "self-engine:settings:synced:appearance.accent";

/** `localStorage` as far as the adapters use it. */
function memoryStorage(initial: Readonly<Record<string, string>> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: LocalSettingsStorage = {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
  const events = { addEventListener: () => {}, removeEventListener: () => {} };
  return { items, environment: { getStorage: () => storage, getEvents: () => events } };
}

/** What the Settings Port's `load` answers with. */
type PortRows = Awaited<ReturnType<SettingsPortConnection["client"]["settings"]["load"]>>;

/** A ready data connection whose Settings Port answers `load` with `rows` once released. */
function heldPort(rows: PortRows) {
  const answer = Promise.withResolvers<void>();
  const save = vi.fn(async () => {});
  const connection: SettingsPortConnection = {
    getState: () => ({ status: "ready" }),
    subscribe: () => () => {},
    onTablesChanged: () => () => {},
    describeEntry: () => ({ kind: "query", reads: ["settings"] }),
    client: {
      settings: {
        load: async () => {
          await answer.promise;
          return rows;
        },
        save,
      },
    },
  };
  return { connection, answer: answer.resolve, save };
}

it("keeps the Synced Settings in localStorage without a Data Process, as the web app does", async () => {
  const { items, environment } = memoryStorage({ [ACCENT_ITEM]: '"green"' });
  const store = createAppSettingsStore(environment, undefined, () => {});

  await store.load();
  store.write(accent, "grape");
  await settle();

  expect(items.get(ACCENT_ITEM)).toBe('"grape"');
});

it("starts the desktop app from the copy and ends on the database's value", async () => {
  const { items, environment } = memoryStorage({ [ACCENT_ITEM]: '"green"' });
  const port = heldPort([{ key: "appearance.accent", value: "grape" }]);
  const store = createAppSettingsStore(environment, port.connection, () => {});

  await store.load();
  const first = store.read(accent);
  port.answer();
  await settle();

  expect(first).toBe("green");
  expect(store.read(accent)).toBe("grape");
  expect(items.get(ACCENT_ITEM)).toBe('"grape"');
});

it("loads the stored App Language and Theme while the desktop Port never answers", async () => {
  const { environment } = memoryStorage({
    "self-engine:settings:synced:i18n.language": '"de"',
    "self-engine:settings:synced:appearance.lightTheme": '"warm"',
  });
  const port = heldPort([]);
  const store = createAppSettingsStore(environment, port.connection, () => {});

  await store.load();

  expect(appLanguageOf(store, ["en"])).toBe("de");
  expect(store.read(lightTheme)).toBe("warm");
});

it("keeps desktop Device Settings in localStorage", async () => {
  const { items, environment } = memoryStorage();
  const port = heldPort([]);
  const store = createAppSettingsStore(environment, port.connection, () => {});
  await store.load();

  store.write(colorMode, "dark");
  await settle();

  expect(items.get("self-engine:settings:device:appearance.colorMode")).toBe('"dark"');
  expect(port.save).not.toHaveBeenCalled();
});
