// The App Language of the throwaway /settings/language-sample page. It sits above the router because every
// text is inside the provider, and it stores nothing. #23 replaces it with the Setting.

import { activateLanguage, type I18n, type Language } from "@self-engine/i18n";
import { LanguageProvider } from "@self-engine/i18n/react";
import { createContext, type ReactNode, use, useMemo, useState } from "react";

/** The App Language, and a switch that rejects and changes nothing when the load fails. */
type LanguageState = readonly [Language, (language: Language) => Promise<void>];

const LanguageContext = createContext<LanguageState | null>(null);

export interface PreviewLanguageProps {
  /** Already showing `initialLanguage`. */
  readonly i18n: I18n;
  readonly initialLanguage: Language;
  readonly children: ReactNode;
}

export function PreviewLanguage({ i18n, initialLanguage, children }: PreviewLanguageProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const state = useMemo<LanguageState>(
    () => [
      language,
      async (next) => {
        await activateLanguage(i18n, next);
        setLanguage(next);
      },
    ],
    [i18n, language],
  );
  return (
    <LanguageContext value={state}>
      <LanguageProvider i18n={i18n} language={language}>
        {children}
      </LanguageProvider>
    </LanguageContext>
  );
}

export function usePreviewLanguage(): LanguageState {
  const state = use(LanguageContext);
  if (state === null) throw new Error("usePreviewLanguage needs PreviewLanguage above it");
  return state;
}
