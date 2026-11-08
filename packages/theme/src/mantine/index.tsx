import {
  createTheme,
  defaultVariantColorsResolver,
  type MantineColorSchemeManager,
  MantineProvider,
  parseThemeColor,
  type VariantColorsResolver,
} from "@mantine/core";
import { createContext, type ReactNode, use, useMemo, useSyncExternalStore } from "react";
import {
  ACCENT_PALETTE,
  type Appearance,
  COLOR_SETS,
  FILL_SHADE,
  type FinalColors,
  type ModeValues,
  resolveAppearance,
  resolveColorMode,
  type ThemeCatalog,
} from "../core/index.ts";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystem(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Keeps Mantine away from localStorage. `forceColorScheme` alone does not: on mount Mantine
 * still reads its manager and applies that value until the forcing effect runs. Paired with
 * `defaultColorScheme`, `get` hands back the scheme the engine resolved.
 */
const NO_STORAGE: MantineColorSchemeManager = {
  get: (defaultValue) => defaultValue,
  set: () => undefined,
  subscribe: () => undefined,
  unsubscribe: () => undefined,
  clear: () => undefined,
};

const COLOR_SET_PALETTES: ReadonlySet<string> = new Set([
  ...Object.keys(COLOR_SETS),
  ACCENT_PALETTE,
]);

/** Filled variants of a Color Set carry its on-fill text instead of Mantine's default white. */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  if (input.variant !== "filled") return colors;
  const parsed = parseThemeColor({ color: input.color, theme: input.theme });
  const isColorSet = parsed.shade === undefined && COLOR_SET_PALETTES.has(parsed.color);
  return isColorSet ? { ...colors, color: `var(--mantine-color-${parsed.color}-contrast)` } : colors;
};

/**
 * Mantine's global CSS draws the focus ring in the filled primary color, with no variable of its
 * own. The extra `:root` wins over it whatever the stylesheet order.
 */
const FOCUS_RING_CSS =
  ":root .mantine-focus-auto:focus-visible,:root .mantine-focus-always:focus{outline-color:var(--se-accent-text)}";

const ColorsContext = createContext<FinalColors | null>(null);

export interface ThemeProviderProps {
  readonly appearance: Appearance;
  readonly catalog: ThemeCatalog;
  readonly children: ReactNode;
}

/** Renders Mantine and the `--se-*` variables from the appearance. Read-only, owns no storage. */
export function ThemeProvider({ appearance, catalog, children }: ThemeProviderProps) {
  const prefersDark = useSyncExternalStore(subscribeToSystem, systemPrefersDark);
  const resolved = useMemo(() => resolveAppearance(appearance, catalog), [appearance, catalog]);
  const scheme = resolveColorMode(appearance.colorMode, prefersDark);
  // Mantine writes numbered shades once for both schemes, so the palettes follow the active one.
  const theme = useMemo(
    () =>
      createTheme({
        primaryColor: ACCENT_PALETTE,
        primaryShade: FILL_SHADE,
        colors: resolved[scheme].palettes,
        variantColorResolver,
      }),
    [resolved, scheme],
  );
  const variablesFor = ({ cssVariables, mantineVariables, colorVariables }: ModeValues) => ({
    ...cssVariables,
    ...mantineVariables,
    ...colorVariables,
  });
  const cssVariablesResolver = () => ({
    variables: {},
    light: variablesFor(resolved.light),
    dark: variablesFor(resolved.dark),
  });
  return (
    <ColorsContext value={resolved[scheme].roles}>
      <MantineProvider
        colorSchemeManager={NO_STORAGE}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme={scheme}
        forceColorScheme={scheme}
        theme={theme}
      >
        <style>{FOCUS_RING_CSS}</style>
        {children}
      </MantineProvider>
    </ColorsContext>
  );
}

/** The final color values of the Color Mode on screen, for canvas charts and native controls. */
export function useFinalColors(): FinalColors {
  const colors = use(ColorsContext);
  if (colors === null) throw new Error("useFinalColors needs a ThemeProvider above it");
  return colors;
}
