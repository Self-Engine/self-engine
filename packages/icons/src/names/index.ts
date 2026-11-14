// The icon of an entry as a value: its names, the emoji rule, the schema a Contract checks with
// and the resolver the mark draws through (D293, D294). This entry loads neither React, nor the
// icon library, nor anything a browser provides, and uses nothing Hermes lacks, so the Data
// Process and a later mobile app agree with the desktop about what is valid.

export { ICON_NAMES, type IconName, isIconName } from "./icon-names.ts";
export { isSingleEmoji } from "./emoji.ts";
export { entryIconSchema } from "./entry-icon-schema.ts";
export { type ResolvedEntryIcon, resolveEntryIcon } from "./entry-icon.ts";
export { OLD_ICON_NAMES, type OldIconKind } from "./old-icon-names.ts";
