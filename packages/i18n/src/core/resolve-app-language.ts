import { BASE_LANGUAGE, LANGUAGES, type Language } from "./languages.ts";

/** The offered language a tag names, if any. Only the language part counts: `de-AT` is German. */
function offeredLanguage(tag: string): Language | undefined {
  const language = tag.split(/[-_]/)[0]?.toLowerCase();
  return language !== undefined && Object.hasOwn(LANGUAGES, language)
    ? (language as Language)
    : undefined;
}

/**
 * The App Language: an offered chosen language, otherwise the first offered system language,
 * otherwise the Base Language. `system` and any unknown value count as no choice.
 */
export function resolveAppLanguage(
  chosen: string | null | undefined,
  systemLanguages: readonly string[],
): Language {
  const candidates = [chosen, ...systemLanguages];
  for (const tag of candidates) {
    const language = tag ? offeredLanguage(tag) : undefined;
    if (language !== undefined) return language;
  }
  return BASE_LANGUAGE;
}
