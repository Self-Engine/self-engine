/** The ids of the area's Views, which are also the last part of their addresses. */
export const VIEW_IDS = {
  appearance: "appearance",
  language: "language",
  shortcuts: "shortcuts",
  data: "data",
  about: "about",
} as const;

export type SettingsViewId = (typeof VIEW_IDS)[keyof typeof VIEW_IDS];

/**
 * The search parameter that holds the text of the settings search. The Views share it, so it
 * stays in the address when the View changes.
 */
export const SEARCH_PARAMETER = "q";
