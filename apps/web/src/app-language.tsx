// The App Language of the app, which follows the settings store alone (ADR 0017). It sits above the
// router because every text is inside the provider. Nothing here writes: the Settings Row of the
// settings area does, and so does another tab or, later, sync.

import { msg } from "@lingui/core/macro";
import { type CatalogLoader, type I18n, type Language, loadAppCatalog } from "@self-engine/i18n";
import type { SettingsStore } from "@self-engine/settings";
import { LanguageProvider } from "@self-engine/i18n/react";
import { notifyError } from "@self-engine/ui";
import { type ReactNode, useEffect, useState } from "react";
import { followAppLanguage } from "./follow-app-language.ts";

const LOAD_FAILED = msg`The language could not be loaded. Your choice is kept for the next start.`;

/** The languages the system prefers, most wanted first. */
export const browserLanguages = () => navigator.languages;

export interface AppLanguageProps {
  /** Already showing `initialLanguage` (`activateLanguage`), so the first frame is translated. */
  readonly i18n: I18n;
  readonly initialLanguage: Language;
  /** The store whose App Language is followed, already loaded. */
  readonly store: SettingsStore;
  readonly loadCatalog?: CatalogLoader;
  readonly systemLanguages?: () => readonly string[];
  readonly children: ReactNode;
}

/**
 * Translates its children and follows the stored choice and the system languages
 * (`followAppLanguage`). A load that fails leaves the language shown and the stored choice as they
 * are, and reports a Notice.
 */
export function AppLanguage({
  i18n,
  initialLanguage,
  store,
  loadCatalog = loadAppCatalog,
  systemLanguages = browserLanguages,
  children,
}: AppLanguageProps) {
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(
    () =>
      followAppLanguage({
        i18n,
        store,
        loadCatalog,
        systemLanguages,
        languageEvents: window,
        onSwitch: setLanguage,
        onLoadFailed: () => notifyError({ message: i18n._(LOAD_FAILED) }),
      }),
    [i18n, store, loadCatalog, systemLanguages],
  );

  return (
    <LanguageProvider i18n={i18n} language={language}>
      {children}
    </LanguageProvider>
  );
}
