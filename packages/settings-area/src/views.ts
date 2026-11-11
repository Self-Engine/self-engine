/** The ids of the area's Views, which are also the last part of their addresses. */
export const VIEW_IDS = { appearance: "appearance", language: "language" } as const;

export type SettingsViewId = (typeof VIEW_IDS)[keyof typeof VIEW_IDS];
