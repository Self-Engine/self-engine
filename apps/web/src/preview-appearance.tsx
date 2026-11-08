// The appearance object of the throwaway /theme-preview page. It sits above the router because
// Mantine allows one MantineProvider per document, so the page cannot wrap itself in a second
// provider. Replaced by the settings store (#15); #23 removes the page.

import { type Appearance, BUILT_IN_THEMES, DEFAULT_APPEARANCE } from "@self-engine/theme";
import { ThemeProvider } from "@self-engine/theme/mantine";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useState,
} from "react";

type AppearanceState = readonly [Appearance, Dispatch<SetStateAction<Appearance>>];

const AppearanceContext = createContext<AppearanceState | null>(null);

export function PreviewAppearance({ children }: { readonly children: ReactNode }) {
  const state = useState(DEFAULT_APPEARANCE);
  return (
    <AppearanceContext value={state}>
      <ThemeProvider appearance={state[0]} catalog={BUILT_IN_THEMES}>
        {children}
      </ThemeProvider>
    </AppearanceContext>
  );
}

export function usePreviewAppearance(): AppearanceState {
  const state = use(AppearanceContext);
  if (state === null) throw new Error("usePreviewAppearance needs PreviewAppearance above it");
  return state;
}
