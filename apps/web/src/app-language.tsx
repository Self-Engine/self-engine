// The App Language of the app, which follows the settings store alone (ADR 0017). It sits above the
// router because every text is inside the provider. Nothing here writes: the Settings Row of the
// settings area does, and so does another tab or, later, sync.

import { msg } from "@lingui/core/macro";
import { type CatalogLoader, type I18n, type Language, loadAppCatalog } from "@self-engine/i18n";
import { LanguageProvider } from "@self-engine/i18n/react";
import { appLanguageOf } from "@self-engine/settings-area/settings";
import { notifyError } from "@self-engine/ui";
import { type ReactNode, useEffect, useState } from "react";
import { settingsStore } from "./settings-store.ts";

const LOAD_FAILED = msg`The language could not be loaded. Your choice is kept for the next start.`;

/** The languages the system prefers, most wanted first. */
export const browserLanguages = () => navigator.languages;

export interface AppLanguageProps {
  /** Already showing `initialLanguage` (`activateLanguage`), so the first frame is translated. */
  readonly i18n: I18n;
  readonly initialLanguage: Language;
  readonly loadCatalog?: CatalogLoader;
  readonly systemLanguages?: () => readonly string[];
  readonly children: ReactNode;
}

/**
 * Translates its children and watches the stored choice and the system languages. On a change it
 * loads the catalog and only then switches, so the app is never half translated. A load that
 * fails leaves the language shown and the stored choice as they are, and reports a Notice.
 */
export function AppLanguage({
  i18n,
  initialLanguage,
  loadCatalog = loadAppCatalog,
  systemLanguages = browserLanguages,
  children,
}: AppLanguageProps) {
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(() => {
    // The language last asked for. A change that asks for the same one again, such as a write to
    // another Setting, neither repeats a failed load nor its Notice.
    let asked = i18n.locale;
    // The newest wish wins: a slower earlier load must not overwrite a later switch.
    let newest = 0;
    async function follow(): Promise<void> {
      const wanted = appLanguageOf(settingsStore, systemLanguages());
      if (wanted === asked) return;
      asked = wanted;
      const wish = ++newest;
      if (wanted === i18n.locale) return;
      try {
        const messages = await loadCatalog(wanted);
        if (wish !== newest) return;
        i18n.loadAndActivate({ locale: wanted, messages });
        setLanguage(wanted);
      } catch {
        // The user is told, and the stored choice applies at the next start. Why the chunk did
        // not arrive is the network's to say, and the error log does not exist yet (#37).
        if (wish === newest) notifyError({ message: i18n._(LOAD_FAILED) });
      }
    }
    const onChange = () => void follow();
    // Every write to the store passes here. Resolving is one read and a comparison, so a change
    // of another Setting costs next to nothing.
    const unsubscribe = settingsStore.subscribe(onChange);
    window.addEventListener("languagechange", onChange);
    // What changed between the start's resolving and this subscription.
    onChange();
    return () => {
      newest += 1;
      unsubscribe();
      window.removeEventListener("languagechange", onChange);
    };
  }, [i18n, loadCatalog, systemLanguages]);

  return (
    <LanguageProvider i18n={i18n} language={language}>
      {children}
    </LanguageProvider>
  );
}
