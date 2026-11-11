import type { MessageDescriptor } from "@lingui/core";

/** A text of a row: a message, or a plain text that is the same in every language. */
export type RowText = MessageDescriptor | string;

/**
 * A text the runtime knows in every language, such as the name of a language: worked out for the
 * language shown, so no catalog has to hold it.
 */
export type LocalText = (locale: string) => string;

/** What of Lingui's `i18n` a text needs to be shown. */
export interface Translator {
  readonly locale: string;
  _(descriptor: MessageDescriptor): string;
}

/** A row's text in the language shown. */
export function shownText(text: RowText | LocalText, i18n: Translator): string {
  if (typeof text === "string") return text;
  return typeof text === "function" ? text(i18n.locale) : i18n._(text);
}
