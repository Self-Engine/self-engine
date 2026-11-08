import type { AccentColors, ResolvedColorMode, ThemeColors } from "./roles.ts";

/** A Color Set per Color Mode, under the Accent role names. */
export type ColorSet = Readonly<Record<ResolvedColorMode, AccentColors>>;

/** A complete table of Color Roles for at least one Color Mode. */
export interface Theme {
  readonly version: 1;
  /** Stored in settings, so a built-in id never changes. */
  readonly id: string;
  readonly name: string;
  readonly colors:
    | { readonly light: ThemeColors; readonly dark?: ThemeColors }
    | { readonly light?: ThemeColors; readonly dark: ThemeColors };
  /** The Theme's own Accent, for "From Theme". Only read for a Color Mode the Theme has. */
  readonly accent?: Partial<ColorSet>;
}

/** Themes by id. Open: built-in and imported Themes sit side by side. */
export type ThemeCatalog = Readonly<Record<string, Theme>>;

export const NEUTRAL_THEME = {
  version: 1,
  id: "neutral",
  name: "Neutral",
  colors: {
    light: {
      chrome: "#f7f7f8",
      canvas: "#ffffff",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      text: "#18181b",
      textMuted: "#63636b",
      border: "#e7e7ea",
      borderControl: "#8a8a93",
      hover: "#18181b14",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#fdecec",
      errorText: "#b42318",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#fef3e2",
      warningText: "#92400e",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#e7f6ec",
      successText: "#166534",
    },
    dark: {
      chrome: "#0e0e10",
      canvas: "#141416",
      surface: "#1a1a1d",
      surfaceRaised: "#202024",
      text: "#ededf0",
      textMuted: "#a1a1aa",
      border: "#2a2a2f",
      borderControl: "#71717a",
      hover: "#ffffff14",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#3b1a1a",
      errorText: "#ff8f8f",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#38260f",
      warningText: "#f5b455",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#123222",
      successText: "#6fd68f",
    },
  },
} as const satisfies Theme;

/** The Theme used when a stored id or Color Mode cannot be served. */
export const DEFAULT_THEME = NEUTRAL_THEME;

export const BUILT_IN_THEMES: ThemeCatalog = { neutral: NEUTRAL_THEME };

const BLUE: ColorSet = {
  light: {
    accent: "#1c6ed5",
    onAccent: "#ffffff",
    accentSoft: "#e7f0fc",
    accentText: "#1a5fc0",
  },
  dark: {
    accent: "#1c6ed5",
    onAccent: "#ffffff",
    accentSoft: "#15294a",
    accentText: "#74b0ff",
  },
};

const INDIGO: ColorSet = {
  light: {
    accent: "#3f51d6",
    onAccent: "#ffffff",
    accentSoft: "#ebedfc",
    accentText: "#3a48c0",
  },
  dark: {
    accent: "#3f51d6",
    onAccent: "#ffffff",
    accentSoft: "#1f2350",
    accentText: "#a3aeff",
  },
};

const VIOLET: ColorSet = {
  light: {
    accent: "#6f42d1",
    onAccent: "#ffffff",
    accentSoft: "#f0ebfc",
    accentText: "#6335c4",
  },
  dark: {
    accent: "#6f42d1",
    onAccent: "#ffffff",
    accentSoft: "#2a1f55",
    accentText: "#b8a0ff",
  },
};

const TEAL: ColorSet = {
  light: {
    accent: "#0b7a6e",
    onAccent: "#ffffff",
    accentSoft: "#e0f5f1",
    accentText: "#0a6c61",
  },
  dark: {
    accent: "#0b7a6e",
    onAccent: "#ffffff",
    accentSoft: "#0f332e",
    accentText: "#4fd1bd",
  },
};

const ORANGE: ColorSet = {
  light: {
    accent: "#b84a0a",
    onAccent: "#ffffff",
    accentSoft: "#fdeee3",
    accentText: "#a8430a",
  },
  dark: {
    accent: "#b84a0a",
    onAccent: "#ffffff",
    accentSoft: "#3a2210",
    accentText: "#ffab70",
  },
};

const GRAPE: ColorSet = {
  light: {
    accent: "#a02cb8",
    onAccent: "#ffffff",
    accentSoft: "#f8e9fb",
    accentText: "#932aa9",
  },
  dark: {
    accent: "#a02cb8",
    onAccent: "#ffffff",
    accentSoft: "#371a40",
    accentText: "#e59af5",
  },
};

const GREEN: ColorSet = {
  light: {
    accent: "#237a3b",
    onAccent: "#ffffff",
    accentSoft: "#e6f5ea",
    accentText: "#1f6e35",
  },
  dark: {
    accent: "#237a3b",
    onAccent: "#ffffff",
    accentSoft: "#16331f",
    accentText: "#77d993",
  },
};

const PINK: ColorSet = {
  light: {
    accent: "#c2255c",
    onAccent: "#ffffff",
    accentSoft: "#fde9f0",
    accentText: "#b02053",
  },
  dark: {
    accent: "#c2255c",
    onAccent: "#ffffff",
    accentSoft: "#3d1a28",
    accentText: "#ff99bf",
  },
};

/** The Accent for "From Theme" when the Theme has none of its own. */
export const DEFAULT_COLOR_SET: ColorSet = BLUE;

/** Every Color Set, all of them usable as a Module Color. */
export const COLOR_SETS: Readonly<Record<string, ColorSet>> = {
  blue: BLUE,
  indigo: INDIGO,
  violet: VIOLET,
  teal: TEAL,
  orange: ORANGE,
  grape: GRAPE,
  green: GREEN,
  pink: PINK,
};

/** The Color Sets a user may pick as the Accent. Green is left out: it reads as `success`. */
export const ACCENT_IDS: readonly string[] = [
  "blue",
  "indigo",
  "violet",
  "teal",
  "orange",
  "grape",
];
