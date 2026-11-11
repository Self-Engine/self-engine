// How the Command Palette and the settings search compare a text with what was typed (D184). A
// file of its own, so that another search shares the rule without loading the palette's code.

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** The ranks of a match; the lower one stands first. */
export const WORD_START = 0;
export const INSIDE_A_WORD = 1;

export type WordMatch = typeof WORD_START | typeof INSIDE_A_WORD;

/**
 * Where `query` stands in `searched`: at the start of a word, only inside words, or nowhere.
 * Both are compared as they are, so the caller brings them to one case. A typo finds nothing.
 */
export function wordMatch(searched: string, query: string): WordMatch | undefined {
  let at = searched.indexOf(query);
  if (at === -1) return undefined;
  for (; at !== -1; at = searched.indexOf(query, at + 1)) {
    if (at === 0 || !WORD_CHARACTER.test(searched[at - 1]!)) return WORD_START;
  }
  return INSIDE_A_WORD;
}
