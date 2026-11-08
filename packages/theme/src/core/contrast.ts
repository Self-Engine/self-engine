import { ACCENT_IDS, type ColorSet, type ThemeCatalog } from "./catalog.ts";
import { composite, contrastRatio } from "./color.ts";
import {
  type Appearance,
  DEFAULT_APPEARANCE,
  FROM_THEME,
  type ModeValues,
  resolveAppearance,
} from "./resolve.ts";
import {
  type AccentColors,
  COLOR_MODES,
  type FinalColors,
  type Hex,
  type ResolvedColorMode,
} from "./roles.ts";
import { fillHover, outlineHover, softHover } from "./variants.ts";

type Role = keyof FinalColors;

const TEXT = 4.5;
const CONTROL = 3;
const HOVER = 1.1;

/** Everything a text can stand on except `chrome`, which only the shell draws on. */
const CONTAINERS = ["navSurface", "canvas", "surface", "surfaceRaised"] as const;
const SURFACES = ["chrome", ...CONTAINERS] as const;
/** Where a Module Color's text appears besides its own soft fill. */
const MODULE_SURFACES = ["navSurface", "canvas", "surface"] as const;

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

type Check = (pair: string, first: Hex, second: Hex, minimum: number) => void;

function collector(): { readonly issues: ContrastIssue[]; readonly check: Check } {
  const issues: ContrastIssue[] = [];
  const check: Check = (pair, first, second, minimum) => {
    const ratio = contrastRatio(first, second);
    if (ratio < minimum) issues.push({ pair, ratio, minimum });
  };
  return { issues, check };
}

function checkFill(check: Check, textName: string, text: Hex, fillName: string, fill: Hex): void {
  check(`${textName} on ${fillName}`, text, fill, TEXT);
  check(`${textName} on ${fillName} hover`, text, fillHover(fill, text), TEXT);
}

function checkSoftHover(check: Check, set: AccentColors): void {
  const hovered = softHover(set.accent, set.accentSoft);
  check("accentText on accentSoft hover", set.accentText, hovered, TEXT);
}

/** The pairs of one Color Mode's final values that miss their minimum. */
export function checkContrast({
  roles,
  moduleColors,
}: Pick<ModeValues, "roles" | "moduleColors">): ContrastIssue[] {
  const { issues, check } = collector();
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
  for (const [text, fill] of FILL_PAIRS) checkFill(check, text, roles[text], fill, roles[fill]);
  checkSoftHover(check, roles);
  for (const surface of CONTAINERS) {
    check(
      `accentText on outline hover over ${surface}`,
      roles.accentText,
      composite(outlineHover(roles.accentText), roles[surface]),
      TEXT,
    );
    on("borderControl", surface, CONTROL);
    check(`focus ring on ${surface}`, roles.accentText, roles[surface], CONTROL);
    check(`hover against ${surface}`, hovered(surface), roles[surface], HOVER);
  }
  for (const [name, color] of Object.entries(moduleColors)) {
    const text = color["--se-module-text"];
    for (const surface of MODULE_SURFACES) {
      check(`${name} module text on ${surface}`, text, roles[surface], TEXT);
    }
    check(`${name} module text on its soft fill`, text, color["--se-module-soft"], TEXT);
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
      (theme.accent?.[colorMode] === undefined ? ACCENT_IDS : [...ACCENT_IDS, FROM_THEME]).flatMap(
        (accent) =>
          [true, false].flatMap((backgroundTint) => {
            const appearance: Appearance = {
              ...DEFAULT_APPEARANCE,
              lightTheme: theme.id,
              darkTheme: theme.id,
              accent,
              backgroundTint,
              colorMode,
            };
            return checkContrast(resolveAppearance(appearance, catalog)[colorMode]).map(
              (issue) => ({ ...issue, theme: theme.id, colorMode, accent, backgroundTint }),
            );
          }),
      ),
    ),
  );
}

export interface ColorSetFailure extends ContrastIssue {
  readonly colorSet: string;
  readonly colorMode: ResolvedColorMode;
}

/** Every failing pair inside the Color Sets, in both Color Modes, independent of any Theme. */
export function auditColorSets(sets: Readonly<Record<string, ColorSet>>): ColorSetFailure[] {
  return Object.entries(sets).flatMap(([colorSet, modes]) =>
    COLOR_MODES.flatMap((colorMode) => {
      const set = modes[colorMode];
      const { issues, check } = collector();
      checkFill(check, "onAccent", set.onAccent, "accent", set.accent);
      check("accentText on accentSoft", set.accentText, set.accentSoft, TEXT);
      checkSoftHover(check, set);
      return issues.map((issue) => ({ ...issue, colorSet, colorMode }));
    }),
  );
}

function formatIssue({ pair, ratio, minimum }: ContrastIssue): string {
  return `${pair} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`;
}

export function formatColorSetFailure(failure: ColorSetFailure): string {
  return `${failure.colorSet} ${failure.colorMode}: ${formatIssue(failure)}`;
}

/** One line that says where the failure is and by how much it misses. */
export function formatContrastFailure(failure: ContrastFailure): string {
  const tint = failure.backgroundTint ? "tint on" : "tint off";
  const context = `${failure.theme} ${failure.colorMode}, accent ${failure.accent}, ${tint}`;
  return `${context}: ${formatIssue(failure)}`;
}
