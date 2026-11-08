/**
 * Every language the app offers: its name in that language, and whether its catalog has to be
 * complete. Adding a language starts here; extraction then creates its catalog.
 */
export const LANGUAGES = {
  en: { name: "English", required: true },
  de: { name: "Deutsch", required: true },
} as const satisfies Readonly<Record<string, { name: string; required: boolean }>>;

export type Language = keyof typeof LANGUAGES;

/** The language every text is first written in, and the fallback for a missing translation. */
export const BASE_LANGUAGE: Language = "en";

/** The tags of the offered languages, in the order of {@link LANGUAGES}. */
export const LANGUAGE_TAGS = Object.keys(LANGUAGES) as readonly Language[];

/** The languages whose catalogs have to be complete; a gap in any other only warns. */
export function requiredLanguages(): Language[] {
  return LANGUAGE_TAGS.filter((language) => LANGUAGES[language].required);
}
