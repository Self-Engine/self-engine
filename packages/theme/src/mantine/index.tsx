import { type MantineColorSchemeManager, MantineProvider } from "@mantine/core";
import {
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  type Appearance,
  type FinalColors,
  type ColorModeValues,
  resolveAppearance,
  resolveColorMode,
  type ThemeCatalog,
  tokenVariables,
} from "../core/index.ts";
import { useInstantChange } from "./instant-change.ts";
import { mantineTheme } from "./theme.ts";
import { useLastInput } from "./use-last-input.ts";
import { useStartCache } from "./use-start-cache.ts";

function systemPreference(query: string) {
  return {
    subscribe: (onChange: () => void): (() => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    matches: () => window.matchMedia(query).matches,
  };
}

const PREFERS_DARK = systemPreference("(prefers-color-scheme: dark)");
const PREFERS_REDUCED_MOTION = systemPreference("(prefers-reduced-motion: reduce)");

/**
 * Keeps Mantine away from localStorage. `forceColorScheme` alone does not: on mount Mantine
 * still reads its manager and applies that value until the forcing effect runs. Paired with
 * `defaultColorScheme`, `get` hands back the Color Mode the engine resolved.
 */
const NO_STORAGE: MantineColorSchemeManager = {
  get: (defaultValue) => defaultValue,
  set: () => undefined,
  subscribe: () => undefined,
  unsubscribe: () => undefined,
  clear: () => undefined,
};

/**
 * Mantine's global CSS draws the focus ring in the filled primary color, with no variable of its
 * own. The extra `:root` wins over it whatever the stylesheet order. After the pointer there is
 * no ring at all, see `useLastInput`.
 */
const FOCUS_RING_CSS =
  ":root .mantine-focus-auto:focus-visible,:root .mantine-focus-always:focus{outline-color:var(--se-accent-text)}:root[data-last-input=pointer] .mantine-focus-auto:focus-visible{outline:none}";

const ColorsContext = createContext<FinalColors | null>(null);

export interface ThemeProviderProps {
  readonly appearance: Appearance;
  readonly catalog: ThemeCatalog;
  readonly children: ReactNode;
}

/** Renders Mantine and the `--se-*` variables from the appearance. Read-only, owns no storage. */
export function ThemeProvider({ appearance, catalog, children }: ThemeProviderProps) {
  const prefersDark = useSyncExternalStore(PREFERS_DARK.subscribe, PREFERS_DARK.matches);
  const reducedMotion = useSyncExternalStore(
    PREFERS_REDUCED_MOTION.subscribe,
    PREFERS_REDUCED_MOTION.matches,
  );
  const resolved = useMemo(() => resolveAppearance(appearance, catalog), [appearance, catalog]);
  const activeColorMode = resolveColorMode(appearance.colorMode, prefersDark);
  const theme = useMemo(() => mantineTheme(resolved, activeColorMode), [resolved, activeColorMode]);
  useInstantChange(JSON.stringify(resolved[activeColorMode].roles));
  useStartCache(appearance.colorMode, resolved);
  useLastInput();
  const { density, densityCss } = resolved.layout;
  useLayoutEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  const variablesFor = ({ cssVariables, mantineVariables, colorVariables }: ColorModeValues) => ({
    ...cssVariables,
    ...mantineVariables,
    ...colorVariables,
  });
  const cssVariablesResolver = () => ({
    variables: tokenVariables({ reducedMotion }),
    light: variablesFor(resolved.light),
    dark: variablesFor(resolved.dark),
  });
  return (
    <ColorsContext value={resolved[activeColorMode].roles}>
      <MantineProvider
        colorSchemeManager={NO_STORAGE}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme={activeColorMode}
        forceColorScheme={activeColorMode}
        theme={theme}
      >
        <style>{`${densityCss}${resolved[activeColorMode].moduleColorCss}${FOCUS_RING_CSS}`}</style>
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
