// The `icon` of an entry: a known name or exactly one emoji (D151, D294). A name is plain ASCII
// and no emoji is, so the two never overlap and no marker tells them apart.

import { isSingleEmoji } from "./emoji.ts";
import { type IconName, isIconName } from "./icon-names.ts";

/** What a stored `icon` stands for. "none" draws the usual icon of the kind of entry. */
export type ResolvedEntryIcon =
  | { readonly kind: "icon"; readonly name: IconName }
  | { readonly kind: "emoji"; readonly emoji: string }
  | { readonly kind: "none" };

/**
 * Resolves the stored text of an `icon`, which a Port returns unchecked, so a name from a newer
 * version or any other text becomes "none" instead of an error. The one place that decides.
 */
export function resolveEntryIcon(value: string | null | undefined): ResolvedEntryIcon {
  if (value === null || value === undefined) return { kind: "none" };
  if (isIconName(value)) return { kind: "icon", name: value };
  if (isSingleEmoji(value)) return { kind: "emoji", emoji: value };
  return { kind: "none" };
}
