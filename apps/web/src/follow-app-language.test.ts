import { createI18n, type Language } from "@self-engine/i18n";
import { createSettingsStore } from "@self-engine/settings";
import { APP_LANGUAGE_SETTING, APPEARANCE_SETTINGS } from "@self-engine/settings-area/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { expect, test } from "vite-plus/test";
import { followAppLanguage } from "./follow-app-language.ts";

/** A catalog load the test finishes by hand, so that the order of two loads is its to choose. */
function heldLoads() {
  const waiting = new Map<Language, { arrive: () => void; fail: () => void }>();
  const asked: Language[] = [];
  return {
    asked,
    load: (language: Language) =>
      new Promise<Record<string, string>>((resolve, reject) => {
        asked.push(language);
        waiting.set(language, {
          arrive: () => resolve({}),
          fail: () => reject(new Error(`The ${language} catalog is out of reach`)),
        });
      }),
    arrive: (language: Language) => waiting.get(language)?.arrive(),
    fail: (language: Language) => waiting.get(language)?.fail(),
  };
}

/** Lets the promises of a finished load run. */
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

async function watching(system: readonly string[] = ["en"]) {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: () => {},
  });
  await store.load();
  const i18n = createI18n();
  i18n.loadAndActivate({ locale: "en", messages: {} });
  const loads = heldLoads();
  const languageEvents = new EventTarget();
  const switched: Language[] = [];
  let failures = 0;
  let systemLanguages = system;
  const stop = followAppLanguage({
    i18n,
    store,
    loadCatalog: loads.load,
    systemLanguages: () => systemLanguages,
    languageEvents,
    onSwitch: (language) => switched.push(language),
    onLoadFailed: () => {
      failures += 1;
    },
  });
  return {
    store,
    i18n,
    loads,
    switched,
    stop,
    failures: () => failures,
    systemBecomes: (languages: readonly string[]) => {
      systemLanguages = languages;
      languageEvents.dispatchEvent(new Event("languagechange"));
    },
  };
}

test("a stored language switches the app only once its catalog has arrived", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  expect(app.loads.asked).toEqual(["de"]);
  expect(app.i18n.locale).toBe("en");
  expect(app.switched).toEqual([]);

  app.loads.arrive("de");
  await settled();
  expect(app.i18n.locale).toBe("de");
  expect(app.switched).toEqual(["de"]);
});

test("the system's languages switch the app while it follows the system", async () => {
  const app = await watching();
  app.systemBecomes(["de-AT", "en"]);
  app.loads.arrive("de");
  await settled();
  expect(app.switched).toEqual(["de"]);
});

test("a chosen language ignores a change of the system's languages", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "en");
  app.systemBecomes(["de-AT"]);
  expect(app.loads.asked).toEqual([]);
});

test("a language chosen between the start and the watching is followed at once", async () => {
  const app = await watching(["de"]);
  expect(app.loads.asked).toEqual(["de"]);
});

test("the newest wish wins over an earlier load that arrives later", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  app.store.write(APP_LANGUAGE_SETTING, "en");
  app.loads.arrive("de");
  await settled();
  expect(app.i18n.locale).toBe("en");
  expect(app.switched).toEqual([]);
});

test("a catalog that fails to load leaves the language and the stored choice, and is reported", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  app.loads.fail("de");
  await settled();
  expect(app.i18n.locale).toBe("en");
  expect(app.switched).toEqual([]);
  expect(app.failures()).toBe(1);
  expect(app.store.read(APP_LANGUAGE_SETTING)).toBe("de");
});

test("a failed language is not loaded again by a write to another Setting", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  app.loads.fail("de");
  await settled();

  app.store.write(APPEARANCE_SETTINGS.density, "compact");
  expect(app.loads.asked).toEqual(["de"]);
  expect(app.failures()).toBe(1);
});

test("a failed language is loaded again once another one was asked for in between", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  app.loads.fail("de");
  await settled();

  app.store.write(APP_LANGUAGE_SETTING, "en");
  app.store.write(APP_LANGUAGE_SETTING, "de");
  expect(app.loads.asked).toEqual(["de", "de"]);
});

test("nothing is followed after the watching has stopped", async () => {
  const app = await watching();
  app.store.write(APP_LANGUAGE_SETTING, "de");
  app.stop();
  app.loads.arrive("de");
  await settled();
  app.systemBecomes(["de"]);
  expect(app.i18n.locale).toBe("en");
  expect(app.switched).toEqual([]);
  expect(app.loads.asked).toEqual(["de"]);
});
