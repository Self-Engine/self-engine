// The Color Set names as values (D293, D294): the list, a schema for writing and a resolver for
// reading. Loads neither React nor Mantine nor the color calculation, and uses nothing a browser
// provides or Hermes lacks, so a Contract, the Data Process and a later mobile app can import it.
// The schema is `zod/mini`, so it never pulls Zod's full build into the startup code (D269).

import { z } from "zod/mini";
import { COLOR_SET_NAMES, type ColorSetName } from "./list.ts";

export { COLOR_SET_NAMES, type ColorSetName };

/** Accepts the name of a Color Set and nothing else: no `gray`, no hex value, no empty text. */
export const colorSetNameSchema = z.enum(COLOR_SET_NAMES);

const KNOWN: ReadonlySet<string> = new Set(COLOR_SET_NAMES);

function isColorSetName(value: string): value is ColorSetName {
  return KNOWN.has(value);
}

/**
 * A stored color as the Color Set it names, or nothing: for an empty value and for every text
 * that names no Color Set, such as `gray` or a name from a newer app version. Never throws.
 */
export function resolveColorSetName(value: string | null | undefined): ColorSetName | undefined {
  return typeof value === "string" && isColorSetName(value) ? value : undefined;
}
