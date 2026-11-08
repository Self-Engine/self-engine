import { type MantineColorSchemeManager, MantineProvider } from "@mantine/core";
import { createContext, type ReactNode, use, useMemo, useSyncExternalStore } from "react";
import {
  type Appearance,
  type FinalColors,
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
  const cssVariablesResolver = () => ({
    variables: {},
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
      >
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
