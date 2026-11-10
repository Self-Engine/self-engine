import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from "react";

/** What stays in the startup bundle. Spotlight itself only loads at the first opening. */
function createCommandPalette() {
  let opened = false;
  let cameFrom: Element | null = null;
  const listeners = new Set<() => void>();
  const setOpened = (next: boolean) => {
    opened = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Right now, at the moment of a key press. */
    isOpen: () => opened,
    open: () => {
      if (opened) return;
      cameFrom = document.activeElement;
      setOpened(true);
    },
    /**
     * Back where the palette was opened, once per opening. The blur matters when that was nowhere:
     * the search field must not count as focused, or a question would come back to it.
     */
    returnFocus: () => {
      if (cameFrom === null) return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (cameFrom instanceof HTMLElement) cameFrom.focus({ preventScroll: true });
      cameFrom = null;
    },
    /**
     * In a later task, for the reason in `confirm()`: Esc goes on to the other listeners on the
     * window, and the browser lets React run between them. Whatever stands behind the palette
     * must not see it gone and act on the same key press. Today the drawers listen first, which
     * only follows from when they mounted, so this does not rely on that.
     */
    scheduleClose: () => setTimeout(() => setOpened(false)),
  };
}

type CommandPaletteHandle = ReturnType<typeof createCommandPalette>;

const CommandPaletteContext = createContext<CommandPaletteHandle | null>(null);

/** Once per Shell. */
export function CommandPaletteProvider({ children }: { readonly children: ReactNode }) {
  const [palette] = useState(createCommandPalette);
  return <CommandPaletteContext value={palette}>{children}</CommandPaletteContext>;
}

export function useCommandPalette(): CommandPaletteHandle {
  const palette = useContext(CommandPaletteContext);
  if (palette === null) throw new Error("The Command Palette needs the Shell");
  return palette;
}

/** The one way to open the Command Palette. Stable, and safe before its code has loaded. */
export const useOpenCommandPalette = () => useCommandPalette().open;

export function useCommandPaletteOpen() {
  const { subscribe, isOpen } = useCommandPalette();
  return useSyncExternalStore(subscribe, isOpen);
}
