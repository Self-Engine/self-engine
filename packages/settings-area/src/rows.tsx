// The one list of Settings Rows (ADR 0016). It sits behind the Views' `load`, so it never enters
// the startup bundle.

import { msg } from "@lingui/core/macro";
import { LANGUAGE_TAGS, LANGUAGES } from "@self-engine/i18n";
import { BUILT_IN_THEMES, FONT_SCALES } from "@self-engine/theme";
import { aboutRows } from "./about-rows.tsx";
import type { SettingsRow } from "./row.ts";
import { APP_LANGUAGE_SETTING, APPEARANCE_SETTINGS, SYSTEM_LANGUAGE } from "./settings.ts";
import { type ShortcutOwner, shortcutRows } from "./shortcut-rows.tsx";
import type { VersionInfo } from "./version.ts";
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

/** Each language under its own name, which no catalog translates, in the order of those names. */
const LANGUAGE_CHOICES = LANGUAGE_TAGS.map((tag) => ({ value: tag, label: LANGUAGES[tag].name }))
  // Compared by code unit, so that the order is the same on every device.
  .sort((a, b) => (a.label < b.label ? -1 : 1));

const LANGUAGE_ROWS: readonly SettingsRow[] = [
  // The row only writes the Setting. The app's watcher above the router loads the catalog and
  // switches (D200).
  choiceRow<string>({
    id: "app-language",
    view: VIEW_IDS.language,
    title: msg`App Language`,
    description: msg`The language the app is shown in. "System" follows the language of this device.`,
    searchWords: [msg`Translation`, msg`German`, msg`English`],
    setting: APP_LANGUAGE_SETTING,
    choices: [
      { value: SYSTEM_LANGUAGE, label: msg({ message: "System", context: "App Language" }) },
      ...LANGUAGE_CHOICES,
    ],
  }),
];

/** What the rows that are produced from other data are produced from. */
export interface SettingsRowSources {
  readonly version: VersionInfo;
  /** The modules whose Commands the View Shortcuts lists. */
  readonly commandOwners: readonly ShortcutOwner[];
}

/** The one list: the rows that are always the same, then those produced from what the app gave. */
export function settingsRows({
  version,
  commandOwners,
}: SettingsRowSources): readonly SettingsRow[] {
  return [
    ...APPEARANCE_ROWS,
    ...LANGUAGE_ROWS,
    ...shortcutRows(commandOwners),
    ...aboutRows(version),
  ];
}
