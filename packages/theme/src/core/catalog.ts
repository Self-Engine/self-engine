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

/** The default Accent, used for "From Theme" and for ids that are not in `COLOR_SETS`. */
export const DEFAULT_COLOR_SET: ColorSet = BLUE;

export const COLOR_SETS: Readonly<Record<string, ColorSet>> = { blue: BLUE };

/** The Color Sets a user may pick as the Accent. */
export const ACCENT_IDS: readonly string[] = ["blue"];
