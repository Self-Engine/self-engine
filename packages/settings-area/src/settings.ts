// The declarations of the Settings this area owns (D202). An entry of its own without interface
// code, because the app reads these Settings before the first render.

import { type Language, resolveAppLanguage } from "@self-engine/i18n";
import {
  defineSetting,
  type SettingChange,
  settingChange,
  type SettingDeclaration,
  type SettingsStore,
} from "@self-engine/settings";
import {
  type Appearance,
  COLOR_MODE_CHOICES,
  DEFAULT_APPEARANCE,
  DENSITIES,
  FONT_SCALES,
} from "@self-engine/theme";
import { z } from "zod";

type AppearanceSettings = {
  readonly [Field in keyof Appearance]: SettingDeclaration<Appearance[Field]>;
};

/**
 * Theme and Accent ids stay open, so an id from a newer app version survives and the resolver
 * falls back at display time. The other fields are closed: the engine throws on an unknown
 * Color Mode while rendering.
 */
export const APPEARANCE_SETTINGS: AppearanceSettings = {
  lightTheme: defineSetting({
    key: "appearance.lightTheme",
    scope: "synced",
    default: DEFAULT_APPEARANCE.lightTheme,
    schema: z.string(),
  }),
  darkTheme: defineSetting({
    key: "appearance.darkTheme",
    scope: "synced",
    default: DEFAULT_APPEARANCE.darkTheme,
    schema: z.string(),
  }),
  accent: defineSetting({
    key: "appearance.accent",
    scope: "synced",
    default: DEFAULT_APPEARANCE.accent,
    schema: z.string(),
  }),
  backgroundTint: defineSetting({
    key: "appearance.backgroundTint",
    scope: "synced",
    default: DEFAULT_APPEARANCE.backgroundTint,
    schema: z.boolean(),
  }),
  colorMode: defineSetting({
    key: "appearance.colorMode",
    scope: "device",
    default: DEFAULT_APPEARANCE.colorMode,
    schema: z.literal(COLOR_MODE_CHOICES),
  }),
  density: defineSetting({
    key: "appearance.density",
    scope: "device",
    default: DEFAULT_APPEARANCE.density,
    schema: z.literal(DENSITIES),
  }),
  fontScale: defineSetting({
    key: "appearance.fontScale",
    scope: "device",
    default: DEFAULT_APPEARANCE.fontScale,
    schema: z.literal(FONT_SCALES),
  }),
};

function changeOf<Field extends keyof Appearance>(
  field: Field,
  value: Appearance[Field],
): SettingChange {
  return settingChange(APPEARANCE_SETTINGS[field], value);
}

/** Only the fields that are given, so that an unknown value of another field stays stored. */
export function appearanceChanges(changed: Partial<Appearance>): SettingChange[] {
  return (Object.keys(APPEARANCE_SETTINGS) as (keyof Appearance)[]).flatMap((field) => {
    const value = changed[field];
    return value === undefined ? [] : [changeOf(field, value)];
  });
}

/** The stored value that means "use the first system language the app offers". */
export const SYSTEM_LANGUAGE = "system";

/**
 * The choice behind the App Language (D200): `system` or the tag of a language. Open, so that a
 * language of a newer app version stays stored; this version then follows the system.
 */
export const APP_LANGUAGE_SETTING = defineSetting({
  key: "i18n.language",
  scope: "synced",
  default: SYSTEM_LANGUAGE,
  schema: z.string(),
});

/** The App Language that the stored choice and the system's languages give. Never writes. */
export function appLanguageOf(store: SettingsStore, systemLanguages: readonly string[]): Language {
  return resolveAppLanguage(store.read(APP_LANGUAGE_SETTING), systemLanguages);
}
