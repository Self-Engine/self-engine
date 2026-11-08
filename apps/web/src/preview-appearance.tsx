// The appearance of the throwaway /theme-preview page. It sits above the router because Mantine
// allows one MantineProvider per document, so the page cannot wrap itself in a second provider.
// #23 removes the page.

import { useSetting } from "@self-engine/settings/react";
import { type Appearance, BUILT_IN_THEMES } from "@self-engine/theme";
import { ThemeProvider } from "@self-engine/theme/mantine";
import type { ReactNode } from "react";
import { APPEARANCE_SETTINGS, appearanceChanges } from "./appearance-settings.ts";
import { settingsStore } from "./settings-store.ts";

function useAppearance(): Appearance {
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

function changeAppearance(changed: Partial<Appearance>): void {
  settingsStore.writeAll(appearanceChanges(changed));
}

export function PreviewAppearance({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider appearance={useAppearance()} catalog={BUILT_IN_THEMES}>
      {children}
    </ThemeProvider>
  );
}

export function usePreviewAppearance() {
  return [useAppearance(), changeAppearance] as const;
}
