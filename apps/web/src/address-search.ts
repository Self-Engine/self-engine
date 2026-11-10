import { parseSearchWith, stringifySearchWith } from "@tanstack/react-router";

/** Written to the address exactly as it is, without the router's quoting of JSON-like strings. */
class VerbatimValue {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const parseJsonSearch = parseSearchWith(JSON.parse);
const stringifyJsonSearch = stringifySearchWith(
  (value) => (value instanceof VerbatimValue ? value.text : JSON.stringify(value)),
  JSON.parse,
);

/**
 * `edit` is the opaque id of an entry, so `?edit=1e5` means the text "1e5" and not a hundred
 * thousand. Everything else keeps the router's parsing; its meaning belongs to the module.
 */
export function parseAddressSearch(searchString: string): Record<string, unknown> {
  const search = parseJsonSearch(searchString) as Record<string, unknown>;
  if (!("edit" in search)) return search;
  return { ...search, edit: new URLSearchParams(searchString).get("edit") };
}

export function stringifyAddressSearch(search: Record<string, unknown>): string {
  return stringifyJsonSearch(
    typeof search.edit === "string" ? { ...search, edit: new VerbatimValue(search.edit) } : search,
  );
}
