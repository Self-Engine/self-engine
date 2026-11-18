import { type I18n, type MessageDescriptor, type Messages, setupI18n } from "@lingui/core";
import type { Language } from "./languages.ts";

export type { I18n, Messages } from "@lingui/core";

/** Delivers the compiled catalog of one language. */
export type CatalogLoader = (language: Language) => Promise<Messages>;

/** A plural message for a noun, selected with the number of entries it names. */
export type CountedName = (count: number) => MessageDescriptor;

/** A list of counts and nouns in the currently active App Language. */
export function formatCountedList(
  i18n: I18n,
  items: readonly { readonly name: CountedName; readonly count: number }[],
): string {
  // Use the conjunction style without the serial comma specified for English in D335.
  const locale = i18n.locale === "en" ? "en-GB" : i18n.locale;
  const list = new Intl.ListFormat(locale);
  return list.format(
    items.map(({ name, count }) => `${i18n.number(count)} ${i18n._(name(count))}`),
  );
}

/** The messages of a `.po` module. A dynamic import with a template has no type to infer. */
export function messagesOf(catalog: unknown): Messages {
  return (catalog as { readonly messages: Messages }).messages;
}

/** The app's catalog of `language`, as a chunk of its own: only the active one is downloaded. */
export const loadAppCatalog: CatalogLoader = async (language) => {
  return messagesOf(await import(`../locales/${language}.po`));
};

/** A translation instance of its own, since Lingui's global instance is not used. */
export function createI18n(): I18n {
  return setupI18n();
}

/** Loads the catalog of `language` and then shows it; the instance changes only after a load. */
export async function activateLanguage(
  i18n: I18n,
  language: Language,
  load: CatalogLoader = loadAppCatalog,
): Promise<void> {
  const messages = await load(language);
  i18n.loadAndActivate({ locale: language, messages });
}
