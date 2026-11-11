import {
  createSettingsStore,
  type JsonValue,
  type SettingScope,
  type SettingsStore,
} from "@self-engine/settings";
import { createTestAdapter, settle, type TestAdapter } from "@self-engine/settings/testing";
import {
  type Appearance,
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  resolveColorMode,
} from "@self-engine/theme";
import { describe, expect, it } from "vite-plus/test";
import {
  APP_LANGUAGE_SETTING,
  APPEARANCE_SETTINGS,
  appearanceChanges,
  appLanguageOf,
} from "./settings.ts";

type Stored = Readonly<Partial<Record<keyof Appearance, JsonValue>>>;

const ignoreStorageErrors = () => {};

/** A loaded store whose adapters hold `stored`, each field in the scope it declares. */
async function storeHolding(stored: Stored) {
  const entriesOf = (scope: SettingScope) =>
    Object.fromEntries(
      Object.entries(stored).flatMap(([field, value]) => {
        const setting = APPEARANCE_SETTINGS[field as keyof Appearance];
        return setting.scope === scope ? [[setting.key, value]] : [];
      }),
    );
  const adapters: Record<SettingScope, TestAdapter> = {
    synced: createTestAdapter(entriesOf("synced")),
    device: createTestAdapter(entriesOf("device")),
  };
  const store = createSettingsStore({ adapters, onError: ignoreStorageErrors });
  await store.load();
  return { store, adapters };
}

function appearanceOf(store: SettingsStore): Appearance {
  return {
    lightTheme: store.read(APPEARANCE_SETTINGS.lightTheme),
    darkTheme: store.read(APPEARANCE_SETTINGS.darkTheme),
    accent: store.read(APPEARANCE_SETTINGS.accent),
    backgroundTint: store.read(APPEARANCE_SETTINGS.backgroundTint),
    colorMode: store.read(APPEARANCE_SETTINGS.colorMode),
    density: store.read(APPEARANCE_SETTINGS.density),
    fontScale: store.read(APPEARANCE_SETTINGS.fontScale),
  };
}

async function appearanceFrom(stored: Stored): Promise<Appearance> {
  return appearanceOf((await storeHolding(stored)).store);
}

describe("the appearance Settings", () => {
  it.each([
    ["lightTheme", "appearance.lightTheme", "synced"],
    ["darkTheme", "appearance.darkTheme", "synced"],
    ["accent", "appearance.accent", "synced"],
    ["backgroundTint", "appearance.backgroundTint", "synced"],
    ["colorMode", "appearance.colorMode", "device"],
    ["density", "appearance.density", "device"],
    ["fontScale", "appearance.fontScale", "device"],
  ] as const)("declares %s as %s in the %s scope", (field, key, scope) => {
    expect(APPEARANCE_SETTINGS[field].key).toBe(key);
    expect(APPEARANCE_SETTINGS[field].scope).toBe(scope);
  });

  it("starts from the default appearance", async () => {
    await expect(appearanceFrom({})).resolves.toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps every valid field", async () => {
    const stored = {
      lightTheme: "cool",
      darkTheme: "warm",
      accent: "green",
      backgroundTint: false,
      colorMode: "dark",
      density: "compact",
      fontScale: 112.5,
    };
    await expect(appearanceFrom(stored)).resolves.toEqual(stored);
  });

  it("fills a missing field from the defaults", async () => {
    await expect(appearanceFrom({ density: "compact" })).resolves.toEqual({
      ...DEFAULT_APPEARANCE,
      density: "compact",
    });
  });

  it.each([
    ["colorMode", "x"],
    ["colorMode", "constructor"],
    ["density", "tiny"],
    ["fontScale", 200],
    ["fontScale", "100"],
    ["backgroundTint", "yes"],
    ["lightTheme", 5],
    ["darkTheme", null],
    ["accent", {}],
    ["colorMode", ["dark"]],
    ["density", 1],
  ])("uses the default for an invalid %s (%j)", async (field, value) => {
    await expect(appearanceFrom({ [field]: value })).resolves.toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps the valid fields beside an invalid one", async () => {
    await expect(appearanceFrom({ colorMode: "x", density: "compact" })).resolves.toEqual({
      ...DEFAULT_APPEARANCE,
      density: "compact",
    });
  });

  it("keeps Theme and Accent ids it does not know, for the resolver's fallback", async () => {
    const stored = { lightTheme: "from-a-newer-app", accent: "from-a-newer-app" };
    await expect(appearanceFrom(stored)).resolves.toEqual({ ...DEFAULT_APPEARANCE, ...stored });
  });

  it("turns an unknown Color Mode into one that has resolved values to render", async () => {
    const appearance = await appearanceFrom({ colorMode: "x" });
    const resolved = resolveAppearance(appearance, BUILT_IN_THEMES);
    expect(resolved[resolveColorMode(appearance.colorMode, false)]).toBeDefined();
  });

  it("leaves an unknown Color Mode stored while another field changes", async () => {
    const { store, adapters } = await storeHolding({ colorMode: "from-a-newer-app" });

    store.writeAll(appearanceChanges({ density: "compact" }));
    await settle();

    expect(adapters.device.saves).toEqual([[{ key: "appearance.density", value: "compact" }]]);
    expect(adapters.device.stored.get("appearance.colorMode")).toBe("from-a-newer-app");
    expect(appearanceOf(store)).toEqual({ ...DEFAULT_APPEARANCE, density: "compact" });
  });

  it("is back after a restart, each field from its own scope", async () => {
    const { store, adapters } = await storeHolding({});

    store.writeAll(appearanceChanges({ accent: "green", backgroundTint: false, fontScale: 112.5 }));
    await settle();

    expect(adapters.synced.stored).toEqual(
      new Map<string, JsonValue>([
        ["appearance.accent", "green"],
        ["appearance.backgroundTint", false],
      ]),
    );
    expect(adapters.device.stored).toEqual(
      new Map<string, JsonValue>([["appearance.fontScale", 112.5]]),
    );

    const restarted = createSettingsStore({ adapters, onError: ignoreStorageErrors });
    await restarted.load();
    expect(appearanceOf(restarted)).toEqual({
      ...DEFAULT_APPEARANCE,
      accent: "green",
      backgroundTint: false,
      fontScale: 112.5,
    });
  });
});

/** A loaded store whose synced adapter holds `stored` as the App Language. */
async function storeHoldingLanguage(stored?: JsonValue) {
  const synced = createTestAdapter(stored === undefined ? {} : { "i18n.language": stored });
  const store = createSettingsStore({
    adapters: { synced, device: createTestAdapter() },
    onError: ignoreStorageErrors,
  });
  await store.load();
  return { store, synced };
}

describe("the App Language Setting", () => {
  it("is the Synced Setting i18n.language and follows the system by default", async () => {
    expect(APP_LANGUAGE_SETTING.key).toBe("i18n.language");
    expect(APP_LANGUAGE_SETTING.scope).toBe("synced");
    expect((await storeHoldingLanguage()).store.read(APP_LANGUAGE_SETTING)).toBe("system");
  });

  it("shows the chosen language, whatever the system uses", async () => {
    const { store } = await storeHoldingLanguage("de");
    expect(appLanguageOf(store, ["en-US"])).toBe("de");
  });

  it.each([
    ["nothing stored", undefined],
    ["system", "system"],
    ["a language of a newer app", "fr"],
    ["a value that is no text", 5],
  ])("follows the system languages with %s", async (_name, stored) => {
    const { store } = await storeHoldingLanguage(stored);
    expect(appLanguageOf(store, ["fr-FR", "de-AT", "en"])).toBe("de");
    expect(appLanguageOf(store, ["fr-FR"])).toBe("en");
  });

  it("leaves a language it does not know stored while it follows the system", async () => {
    const { store, synced } = await storeHoldingLanguage("fr");

    expect(store.read(APP_LANGUAGE_SETTING)).toBe("fr");
    appLanguageOf(store, ["de"]);
    await settle();

    expect(synced.saves).toEqual([]);
    expect(synced.stored.get("i18n.language")).toBe("fr");
  });

  it("is back after a restart", async () => {
    const { store, synced } = await storeHoldingLanguage();

    store.write(APP_LANGUAGE_SETTING, "de");
    await settle();

    const restarted = createSettingsStore({
      adapters: { synced, device: createTestAdapter() },
      onError: ignoreStorageErrors,
    });
    await restarted.load();
    expect(appLanguageOf(restarted, ["en"])).toBe("de");
  });
});
