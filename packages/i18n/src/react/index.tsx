import { I18nProvider } from "@lingui/react";
import { type ReactNode, useLayoutEffect } from "react";
import type { I18n, Language } from "../core/index.ts";

export interface LanguageProviderProps {
  /** The app's translation instance, already showing `language` (`activateLanguage`). */
  readonly i18n: I18n;
  /** The App Language. An input, so that this package knows nothing about Settings. */
  readonly language: Language;
  readonly children: ReactNode;
}

/** Translates its children with `i18n`, and keeps the document's language attribute in step. */
export function LanguageProvider({ i18n, language, children }: LanguageProviderProps) {
  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
