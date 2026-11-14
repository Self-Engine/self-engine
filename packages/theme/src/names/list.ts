// The list apart from its schema, so the theme core can type its catalog against it without
// loading Zod.

/**
 * The names of the Color Sets, around the color wheel from red: the twelve color names of the
 * old app (D151, D295). The source of the catalog, which is typed against it. A name is stored
 * on entries, so it never changes.
 */
export const COLOR_SET_NAMES = [
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
] as const;

export type ColorSetName = (typeof COLOR_SET_NAMES)[number];
