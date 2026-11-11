// The one list of Settings Rows (ADR 0016). It sits behind the Views' `load`, so it never enters
// the startup bundle.

import { msg } from "@lingui/core/macro";
import { BUILT_IN_THEMES, FONT_SCALES } from "@self-engine/theme";
import type { SettingsRow } from "./row.ts";
import { APPEARANCE_SETTINGS } from "./settings.ts";
import { choiceRow, stopsRow, switchRow } from "./standard-rows.tsx";
import { accentRow, themeRow } from "./theme-rows.tsx";
import { VIEW_IDS } from "./views.ts";

const APPEARANCE_ROWS: readonly SettingsRow[] = [
  choiceRow({
    id: "color-mode",
    view: VIEW_IDS.appearance,
    title: msg`Color Mode`,
    description: msg`Show the app light or dark, or follow the system.`,
    searchWords: [msg`Dark mode`, msg`Light mode`, msg`Night`],
    setting: APPEARANCE_SETTINGS.colorMode,
    choices: [
      { value: "light", label: msg({ message: "Light", context: "Color Mode" }) },
      { value: "dark", label: msg({ message: "Dark", context: "Color Mode" }) },
      { value: "system", label: msg({ message: "System", context: "Color Mode" }) },
    ],
  }),
  themeRow(BUILT_IN_THEMES),
  accentRow(BUILT_IN_THEMES),
  choiceRow({
    id: "density",
    view: VIEW_IDS.appearance,
    title: msg`Density`,
    description: msg`How tightly lists and controls are laid out. The size of the text stays the same.`,
    searchWords: [msg`Spacing`, msg`Row height`],
    setting: APPEARANCE_SETTINGS.density,
    choices: [
      { value: "comfortable", label: msg({ message: "Comfortable", context: "Density" }) },
      { value: "compact", label: msg({ message: "Compact", context: "Density" }) },
    ],
  }),
  switchRow({
    id: "background-tint",
    view: VIEW_IDS.appearance,
    title: msg`Background Tint`,
    description: msg`Color the app's outermost background slightly with the Accent.`,
    searchWords: [msg`Neutral background`],
    setting: APPEARANCE_SETTINGS.backgroundTint,
  }),
  stopsRow({
    id: "font-scale",
    view: VIEW_IDS.appearance,
    title: msg`Font scale`,
    description: msg`The size of the text in the whole app.`,
    searchWords: [msg`Text size`, msg`Font size`, msg`Zoom`],
    setting: APPEARANCE_SETTINGS.fontScale,
    stops: FONT_SCALES,
    format: (stop, i18n) => i18n.number(stop / 100, { style: "percent", maximumFractionDigits: 2 }),
  }),
];

export const SETTINGS_ROWS: readonly SettingsRow[] = APPEARANCE_ROWS;
