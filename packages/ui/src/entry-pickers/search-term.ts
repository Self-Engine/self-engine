// A single emoji in the search of the icon field is the choice (D302), so an emoji pasted from
// the clipboard or typed with the emoji keyboard of the operating system is taken. It runs on
// every keystroke in both tabs: one anchored regular expression over the term, which fails at
// its first character for a word, and needs no emoji data.

import { isSingleEmoji } from "@self-engine/icons/names";

/** The emoji a search term is, without the space around it, or `undefined` for any other text. */
export function emojiOfSearchTerm(term: string): string | undefined {
  const trimmed = term.trim();
  return isSingleEmoji(trimmed) ? trimmed : undefined;
}
