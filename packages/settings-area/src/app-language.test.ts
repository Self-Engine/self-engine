import { createSettingsStore, type JsonValue } from "@self-engine/settings";
import { createTestAdapter, settle } from "@self-engine/settings/testing";
import { describe, expect, it } from "vite-plus/test";
import { APP_LANGUAGE_SETTING, appLanguageOf } from "./settings.ts";

/** A loaded store whose synced adapter holds `stored` as the App Language. */
async function storeHolding(stored?: JsonValue) {
  const synced = createTestAdapter(stored === undefined ? {} : { "i18n.language": stored });
  const store = createSettingsStore({
    adapters: { synced, device: createTestAdapter() },
    onError: () => {},
  });
  await store.load();
  return { store, synced };
}

describe("the App Language Setting", () => {
  it("is the Synced Setting i18n.language and follows the system by default", async () => {
    expect(APP_LANGUAGE_SETTING.key).toBe("i18n.language");
    expect(APP_LANGUAGE_SETTING.scope).toBe("synced");
    expect((await storeHolding()).store.read(APP_LANGUAGE_SETTING)).toBe("system");
  });

  it("shows the chosen language, whatever the system uses", async () => {
    const { store } = await storeHolding("de");
    expect(appLanguageOf(store, ["en-US"])).toBe("de");
  });

  it.each([
    ["nothing stored", undefined],
    ["system", "system"],
    ["a language of a newer app", "fr"],
    ["a value that is no text", 5],
  ])("follows the system languages with %s", async (_name, stored) => {
    const { store } = await storeHolding(stored);
    expect(appLanguageOf(store, ["fr-FR", "de-AT", "en"])).toBe("de");
    expect(appLanguageOf(store, ["fr-FR"])).toBe("en");
  });

  it("leaves a language it does not know stored while it follows the system", async () => {
    const { store, synced } = await storeHolding("fr");

    expect(store.read(APP_LANGUAGE_SETTING)).toBe("fr");
    appLanguageOf(store, ["de"]);
    await settle();

    expect(synced.saves).toEqual([]);
    expect(synced.stored.get("i18n.language")).toBe("fr");
  });

  it("is back after a restart", async () => {
    const { store, synced } = await storeHolding();

    store.write(APP_LANGUAGE_SETTING, "de");
    await settle();

    const restarted = createSettingsStore({
      adapters: { synced, device: createTestAdapter() },
      onError: () => {},
    });
    await restarted.load();
    expect(appLanguageOf(restarted, ["en"])).toBe("de");
  });
});
