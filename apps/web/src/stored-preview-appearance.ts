// Stored JSON is open text, but the engine trusts the closed types of an Appearance: an unknown
// Color Mode throws while rendering, above the router. Goes with the page (#23).

import {
  type Appearance,
  COLOR_MODES,
  type ColorMode,
  DEFAULT_APPEARANCE,
  DENSITIES,
  FONT_SCALES,
} from "@self-engine/theme";

const COLOR_MODE_SETTINGS: readonly ColorMode[] = [...COLOR_MODES, "system"];

function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** Each invalid field takes its default. Unknown Theme and Accent ids stay for the resolver. */
export function appearanceFromStored(stored: unknown): Appearance {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return DEFAULT_APPEARANCE;
  }
  const fields = stored as Readonly<Partial<Record<keyof Appearance, unknown>>>;
  return {
    lightTheme: text(fields.lightTheme, DEFAULT_APPEARANCE.lightTheme),
    darkTheme: text(fields.darkTheme, DEFAULT_APPEARANCE.darkTheme),
    accent: text(fields.accent, DEFAULT_APPEARANCE.accent),
    backgroundTint:
      typeof fields.backgroundTint === "boolean"
        ? fields.backgroundTint
        : DEFAULT_APPEARANCE.backgroundTint,
    colorMode: oneOf(COLOR_MODE_SETTINGS, fields.colorMode, DEFAULT_APPEARANCE.colorMode),
    density: oneOf(DENSITIES, fields.density, DEFAULT_APPEARANCE.density),
    fontScale: oneOf(FONT_SCALES, fields.fontScale, DEFAULT_APPEARANCE.fontScale),
  };
}
