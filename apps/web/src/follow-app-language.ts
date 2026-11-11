// The watcher of the App Language (ADR 0017), without React, so that its flow is tested on a
// store and a catalog loader of the test's own.

import type { CatalogLoader, I18n, Language } from "@self-engine/i18n";
import type { SettingsStore } from "@self-engine/settings";
import { appLanguageOf } from "@self-engine/settings-area/settings";

export interface AppLanguageWatch {
  /** Already showing a language; the watcher switches it once a catalog has arrived. */
  readonly i18n: I18n;
  readonly store: SettingsStore;
  readonly loadCatalog: CatalogLoader;
  /** The languages the system prefers, most wanted first. */
  readonly systemLanguages: () => readonly string[];
  /** Where the system says that its languages changed: the window, in the app. */
  readonly languageEvents: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  /** The app now shows `language`. */
  readonly onSwitch: (language: Language) => void;
  /** A catalog did not arrive. The language shown and the stored choice are as they were. */
  readonly onLoadFailed: () => void;
}

/**
 * Watches the stored choice and the system languages until the returned function is called. On a
 * change it loads the catalog and only then switches, so the app is never half translated.
 */
export function followAppLanguage({
  i18n,
  store,
  loadCatalog,
  systemLanguages,
  languageEvents,
  onSwitch,
  onLoadFailed,
}: AppLanguageWatch): () => void {
  // The language last asked for. A change that asks for the same one again, such as a write to
  // another Setting, neither repeats a failed load nor its report.
  let asked = i18n.locale;
  // The newest wish wins: a slower earlier load must not overwrite a later switch.
  let newest = 0;
  async function follow(): Promise<void> {
    const wanted = appLanguageOf(store, systemLanguages());
    if (wanted === asked) return;
    asked = wanted;
    const wish = ++newest;
    if (wanted === i18n.locale) return;
    try {
      const messages = await loadCatalog(wanted);
      if (wish !== newest) return;
      i18n.loadAndActivate({ locale: wanted, messages });
      onSwitch(wanted);
    } catch {
      // The user is told, and the stored choice applies at the next start. Why the chunk did
      // not arrive is the network's to say, and the error log does not exist yet (#37).
      if (wish === newest) onLoadFailed();
    }
  }
  const onChange = () => void follow();
  // Every write to the store passes here. Resolving is one read and a comparison, so a change
  // of another Setting costs next to nothing.
  const unsubscribe = store.subscribe(onChange);
  languageEvents.addEventListener("languagechange", onChange);
  // What changed between the start's resolving and this subscription.
  onChange();
  return () => {
    newest += 1;
    unsubscribe();
    languageEvents.removeEventListener("languagechange", onChange);
  };
}
