import { useLingui } from "@lingui/react";
import { useMemo } from "react";

const collators = new Map<string, Intl.Collator>();

/** One collator per language: building one costs more than many comparisons. */
function collatorFor(locale: string): Intl.Collator {
  let collator = collators.get(locale);
  if (collator === undefined) {
    collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    collators.set(locale, collator);
  }
  return collator;
}

/**
 * The entries sorted by title with the App Language's rules, so that "Ärzte" stands between
 * "Arbeit" and "Auto". Equal titles keep the order of the answer. The sort runs again only when
 * the answer or the language changes.
 */
export function useSortedByTitle<Entry extends { readonly title: string }>(
  entries: readonly Entry[],
): readonly Entry[] {
  const { i18n } = useLingui();
  const { locale } = i18n;
  return useMemo(() => {
    const { compare } = collatorFor(locale);
    return entries.toSorted((a, b) => compare(a.title, b.title));
  }, [entries, locale]);
}
