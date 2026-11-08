import { ACCENT_IDS, type ThemeCatalog } from "./catalog.ts";
import { composite, contrastRatio } from "./color.ts";
import { type Appearance, DEFAULT_APPEARANCE, resolveAppearance } from "./resolve.ts";
import { COLOR_MODES, type FinalColors, type Hex, type ResolvedColorMode } from "./roles.ts";

type Role = keyof FinalColors;

const TEXT = 4.5;
const CONTROL = 3;
const HOVER = 1.1;

/** Everything a text can stand on except `chrome`, which only the shell draws on. */
const CONTAINERS = ["navSurface", "canvas", "surface", "surfaceRaised"] as const;
const SURFACES = ["chrome", ...CONTAINERS] as const;

/** Each colored text with the soft fill it sits on. */
const SOFT_PAIRS = [
  ["accentText", "accentSoft"],
  ["errorText", "errorSoft"],
  ["warningText", "warningSoft"],
  ["successText", "successSoft"],
] as const;

const FILL_PAIRS = [
  ["onAccent", "accent"],
  ["onError", "error"],
  ["onWarning", "warning"],
  ["onSuccess", "success"],
] as const;

export interface ContrastIssue {
  readonly pair: string;
  readonly ratio: number;
  readonly minimum: number;
}

/** The pairs of one Color Mode's final values that miss their minimum. */
export function checkContrast(roles: FinalColors): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const check = (pair: string, first: Hex, second: Hex, minimum: number) => {
    const ratio = contrastRatio(first, second);
    if (ratio < minimum) issues.push({ pair, ratio, minimum });
  };
  const on = (foreground: Role, background: Role, minimum: number) =>
    check(`${foreground} on ${background}`, roles[foreground], roles[background], minimum);
  const hovered = (surface: Role) => composite(roles.hover, roles[surface]);

  for (const text of ["text", "textMuted"] as const) {
    for (const surface of SURFACES) on(text, surface, TEXT);
    for (const surface of CONTAINERS) {
      check(`${text} on hover over ${surface}`, roles[text], hovered(surface), TEXT);
    }
  }
  for (const [colored, soft] of SOFT_PAIRS) {
    for (const surface of CONTAINERS) on(colored, surface, TEXT);
    on(colored, soft, TEXT);
    on("text", soft, TEXT);
  }
  for (const [text, fill] of FILL_PAIRS) on(text, fill, TEXT);
  for (const surface of CONTAINERS) {
    on("borderControl", surface, CONTROL);
    check(`focus ring on ${surface}`, roles.accentText, roles[surface], CONTROL);
    check(`hover against ${surface}`, hovered(surface), roles[surface], HOVER);
  }
  return issues;
}

export interface ContrastFailure extends ContrastIssue {
  readonly theme: string;
  readonly colorMode: ResolvedColorMode;
  readonly accent: string;
  readonly backgroundTint: boolean;
}

/** Every failing pair over the catalog's Themes, their Color Modes, the Accents and the Tint. */
export function auditContrast(catalog: ThemeCatalog): ContrastFailure[] {
  return Object.values(catalog).flatMap((theme) =>
    COLOR_MODES.filter((mode) => theme.colors[mode] !== undefined).flatMap((colorMode) =>
      ACCENT_IDS.flatMap((accent) =>
        [true, false].flatMap((backgroundTint) => {
          const appearance: Appearance = {
            ...DEFAULT_APPEARANCE,
            lightTheme: theme.id,
            darkTheme: theme.id,
            accent,
            backgroundTint,
            colorMode,
          };
          return checkContrast(resolveAppearance(appearance, catalog)[colorMode].roles).map(
            (issue) => ({ ...issue, theme: theme.id, colorMode, accent, backgroundTint }),
          );
        }),
      ),
    ),
  );
}

/** One line that says where the failure is and by how much it misses. */
export function formatContrastFailure(failure: ContrastFailure): string {
  const tint = failure.backgroundTint ? "tint on" : "tint off";
  const context = `${failure.theme} ${failure.colorMode}, accent ${failure.accent}, ${tint}`;
  return `${context}: ${failure.pair} is ${failure.ratio.toFixed(2)}:1, needs ${failure.minimum}:1`;
}
