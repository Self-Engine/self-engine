import {
  type MantineColorSchemeManager,
  MantineProvider,
  type MantineThemeOverride,
} from "@mantine/core";
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
  FONT_FAMILY,
  resolveAppearance,
  resolveColorMode,
  type ThemeCatalog,
  tokenVariables,
} from "../core/index.ts";
import { useInstantChange } from "./instant-change.ts";
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

/** Setting `fontFamily` also sets the headings; Mantine copies it to them when merging. */
const MANTINE_THEME: MantineThemeOverride = {
  fontFamily: FONT_FAMILY,
  fontFamilyMonospace: FONT_FAMILY,
  respectReducedMotion: true,
};

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
  const scheme = resolveColorMode(appearance.colorMode, prefersDark);
  useInstantChange(JSON.stringify(resolved[scheme].roles));
  useStartCache(appearance.colorMode, resolved);
  const { density, densityCss, mantineComponents, rootFontSize } = resolved.layout;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;
    root.style.fontSize = rootFontSize;
  }, [density, rootFontSize]);
  const mantineTheme = useMemo(
    () => ({ ...MANTINE_THEME, components: mantineComponents }),
    [mantineComponents],
  );
  const cssVariablesResolver = () => ({
    variables: tokenVariables({ reducedMotion }),
    light: { ...resolved.light.cssVariables, ...resolved.light.mantineVariables },
    dark: { ...resolved.dark.cssVariables, ...resolved.dark.mantineVariables },
  });
  return (
    <ColorsContext value={resolved[scheme].roles}>
      <MantineProvider
        colorSchemeManager={NO_STORAGE}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme={scheme}
        forceColorScheme={scheme}
        theme={mantineTheme}
      >
        <style>{densityCss}</style>
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
