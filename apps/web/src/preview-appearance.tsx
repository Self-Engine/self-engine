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
  useEffect,
  useState,
} from "react";

type AppearanceState = readonly [Appearance, Dispatch<SetStateAction<Appearance>>];

const AppearanceContext = createContext<AppearanceState | null>(null);

// Survives a reload so that the first frame from the Start Cache can be judged on this page.
const STORAGE_KEY = "self-engine:theme-preview";

function readStoredAppearance(): Appearance {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Appearance>;
    return { ...DEFAULT_APPEARANCE, ...stored };
  } catch {
    // Blocked storage or a damaged entry: this throwaway page just starts from the defaults.
    return DEFAULT_APPEARANCE;
  }
}

function storeAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // The page then simply starts from the defaults again.
  }
}

export function PreviewAppearance({ children }: { readonly children: ReactNode }) {
  const state = useState(readStoredAppearance);
  const [appearance] = state;
  useEffect(() => storeAppearance(appearance), [appearance]);
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
