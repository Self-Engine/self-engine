// What the settings search finds (D199). The rule is the Command Palette's, from the Shell's
// `wordMatch`; this file only says what of a Settings Row is compared and how hits are grouped.

import { wordMatch } from "@self-engine/shell";
import type { SettingsRow } from "./row.ts";
import { shownText, type Translator } from "./text.ts";

/** What of a Settings Row the search reads. */
export type SearchableRow = Pick<
  SettingsRow,
  "id" | "view" | "title" | "description" | "searchWords" | "values"
>;

export interface SearchedRow<Row extends SearchableRow> {
  readonly row: Row;
  /** Everything that finds the row, as it is compared. */
  readonly searched: string;
}

/**
 * The rows with their text in the language shown: title, description, search words and the names
 * of the values. Worked out once per language and not per key press.
 */
export function searchedRows<Row extends SearchableRow>(
  rows: readonly Row[],
  i18n: Translator,
): readonly SearchedRow<Row>[] {
  return rows.map((row) => ({
    row,
    searched: [row.title, row.description, ...row.searchWords, ...row.values]
      .flatMap((part) => (part === undefined ? [] : [shownText(part, i18n)]))
      // A line break belongs to no word and is in no search text, so a match never spans two parts.
      .join("\n")
      .toLowerCase(),
  }));
}

/** The hits of one View, in the order they are shown. */
export interface HitGroup<Row extends SearchableRow> {
  readonly view: string;
  readonly rows: readonly Row[];
}

/**
 * The rows a search text finds, each View's together: a match at the start of a word before a
 * match inside a word, then the order in the list. `undefined` when there is nothing to search
 * for, which shows the View instead; an empty list when nothing matches.
 */
export function searchHits<Row extends SearchableRow>(
  rows: readonly SearchedRow<Row>[],
  search: string,
): readonly HitGroup<Row>[] | undefined {
  const query = search.trim().toLowerCase();
  if (query === "") return undefined;
  const found = rows
    .flatMap(({ row, searched }) => {
      const match = wordMatch(searched, query);
      return match === undefined ? [] : [{ row, match }];
    })
    .toSorted((a, b) => a.match - b.match);
  const groups = new Map<string, Row[]>();
  // A Map keeps its first insertion, so the Views stand in the order of their best match.
  for (const { row } of found) {
    const group = groups.get(row.view);
    if (group) group.push(row);
    else groups.set(row.view, [row]);
  }
  return [...groups].map(([view, group]) => ({ view, rows: group }));
}
