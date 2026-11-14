import type { ColorSetName } from "../names/list.ts";
import type { ColorSetColors, ResolvedColorMode, ThemeColors } from "./roles.ts";

/** A Color Set per Color Mode, under the Accent role names. */
export type ColorSet = Readonly<Record<ResolvedColorMode, ColorSetColors>>;

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
      textMuted: "#62626a",
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

export const WARM_THEME = {
  version: 1,
  id: "warm",
  name: "Warm",
  colors: {
    light: {
      chrome: "#f8f5f0",
      canvas: "#fffdfa",
      surface: "#fffdfa",
      surfaceRaised: "#ffffff",
      text: "#1c1917",
      textMuted: "#655f58",
      border: "#ebe5dc",
      borderControl: "#8e867b",
      hover: "#1c191714",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#fdece8",
      errorText: "#b42318",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#fdf1dd",
      warningText: "#92400e",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#ebf5e6",
      successText: "#166534",
    },
    dark: {
      chrome: "#100e0c",
      canvas: "#171412",
      surface: "#1e1a17",
      surfaceRaised: "#25201c",
      text: "#f0ebe4",
      textMuted: "#aba297",
      border: "#302a25",
      borderControl: "#7c7369",
      hover: "#ffffff14",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#3d1b17",
      errorText: "#ff9184",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#3a270e",
      warningText: "#f5b455",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#1b3220",
      successText: "#7ad68a",
    },
  },
} as const satisfies Theme;

export const COOL_THEME = {
  version: 1,
  id: "cool",
  name: "Cool",
  colors: {
    light: {
      chrome: "#f4f6f9",
      canvas: "#fcfdfe",
      surface: "#fcfdfe",
      surfaceRaised: "#ffffff",
      text: "#161c26",
      textMuted: "#566070",
      border: "#e2e7ee",
      borderControl: "#808b9a",
      hover: "#161c2614",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#fcecf0",
      errorText: "#b42318",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#fbf2e6",
      warningText: "#92400e",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#e4f5ef",
      successText: "#166534",
    },
    dark: {
      chrome: "#0c1016",
      canvas: "#11161d",
      surface: "#171d26",
      surfaceRaised: "#1e2530",
      text: "#e8edf3",
      textMuted: "#9eaab8",
      border: "#27303b",
      borderControl: "#6c7888",
      hover: "#ffffff14",
      error: "#c92a2a",
      onError: "#ffffff",
      errorSoft: "#3a1a22",
      errorText: "#ff8f9c",
      warning: "#b45309",
      onWarning: "#ffffff",
      warningSoft: "#33270f",
      warningText: "#f5b455",
      success: "#15803d",
      onSuccess: "#ffffff",
      successSoft: "#10332b",
      successText: "#6fd6a0",
    },
  },
} as const satisfies Theme;

/** The Theme used when a stored id or Color Mode cannot be served. */
export const DEFAULT_THEME = NEUTRAL_THEME;

export const BUILT_IN_THEMES: ThemeCatalog = {
  neutral: NEUTRAL_THEME,
  warm: WARM_THEME,
  cool: COOL_THEME,
};

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

/** The Neutral Theme's error color, as in the old app. */
const RED: ColorSet = {
  light: {
    accent: "#c92a2a",
    onAccent: "#ffffff",
    accentSoft: "#fdecec",
    accentText: "#b42318",
  },
  dark: {
    accent: "#c92a2a",
    onAccent: "#ffffff",
    accentSoft: "#3b1a1a",
    accentText: "#ff8f8f",
  },
};

// Cyan, lime and yellow keep a bright fill, so they stay recognizable in bars and charts, and
// carry dark text on it (D295).

const CYAN: ColorSet = {
  light: {
    accent: "#1fb6d1",
    onAccent: "#04252b",
    accentSoft: "#e0f4f8",
    accentText: "#0b6779",
  },
  dark: {
    accent: "#1fb6d1",
    onAccent: "#04252b",
    accentSoft: "#0e2f38",
    accentText: "#56cfe6",
  },
};

const LIME: ColorSet = {
  light: {
    accent: "#8fd11f",
    onAccent: "#1b2a05",
    accentSoft: "#eef6dc",
    accentText: "#4a6b0f",
  },
  dark: {
    accent: "#8fd11f",
    onAccent: "#1b2a05",
    accentSoft: "#25330f",
    accentText: "#a8dc55",
  },
};

const YELLOW: ColorSet = {
  light: {
    accent: "#f6bd0c",
    onAccent: "#2a1f00",
    accentSoft: "#fbf1cf",
    accentText: "#7a5700",
  },
  dark: {
    accent: "#f6bd0c",
    onAccent: "#2a1f00",
    accentSoft: "#382d0a",
    accentText: "#f0c94a",
  },
};

/** The Accent for "From Theme" when the Theme has none of its own. */
export const DEFAULT_COLOR_SET: ColorSet = BLUE;

/** Every Color Set, all of them usable as a Module Color, in the order of the names. */
export const COLOR_SETS = {
  red: RED,
  pink: PINK,
  grape: GRAPE,
  violet: VIOLET,
  indigo: INDIGO,
  blue: BLUE,
  cyan: CYAN,
  teal: TEAL,
  green: GREEN,
  lime: LIME,
  yellow: YELLOW,
  orange: ORANGE,
} as const satisfies Readonly<Record<ColorSetName, ColorSet>>;

/**
 * The Color Sets a user may pick as the Accent. Green, red and yellow are left out, because they
 * read as `success`, `error` and `warning`; pink, cyan and lime are colors for entries only. A
 * stored Accent stays an open string; the engine compares it against this list, so a stored
 * name of another Color Set means "From Theme".
 */
export const ACCENT_IDS: readonly ColorSetName[] = [
  "blue",
  "indigo",
  "violet",
  "teal",
  "orange",
  "grape",
];
