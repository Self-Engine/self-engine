// The appearance of the app, read from the settings store. It sits above the router because Mantine
// allows one MantineProvider per document. Nothing here writes: the Settings Rows of the settings
// area do, through the same store.

import { useSetting } from "@self-engine/settings/react";
import { APPEARANCE_SETTINGS } from "@self-engine/settings-area/settings";
import { type Appearance, BUILT_IN_THEMES } from "@self-engine/theme";
import { ThemeProvider } from "@self-engine/theme/mantine";
import type { ReactNode } from "react";
import { settingsStore } from "./settings-store.ts";

/** The stored appearance; rerenders when one of its Settings changes. */
export function useAppearance(): Appearance {
  return {
    lightTheme: useSetting(settingsStore, APPEARANCE_SETTINGS.lightTheme),
    darkTheme: useSetting(settingsStore, APPEARANCE_SETTINGS.darkTheme),
    accent: useSetting(settingsStore, APPEARANCE_SETTINGS.accent),
    backgroundTint: useSetting(settingsStore, APPEARANCE_SETTINGS.backgroundTint),
    colorMode: useSetting(settingsStore, APPEARANCE_SETTINGS.colorMode),
    density: useSetting(settingsStore, APPEARANCE_SETTINGS.density),
    fontScale: useSetting(settingsStore, APPEARANCE_SETTINGS.fontScale),
  };
}

export function AppearanceProvider({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider appearance={useAppearance()} catalog={BUILT_IN_THEMES}>
      {children}
    </ThemeProvider>
  );
}
