import { useLingui } from "@lingui/react/macro";
import { notifyError } from "@self-engine/ui";
import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { PaletteOwner } from "./palette-entries.ts";

export interface CommandPaletteProps {
  readonly owners: readonly PaletteOwner[];
  readonly activeModuleId: string | undefined;
}

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
    finished: () => setTimeout(() => setOpened(false)),
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

/** Loads the dialog at the first opening, and from then on it stays mounted and closed. */
export function CommandPalette(props: CommandPaletteProps) {
  const { t } = useLingui();
  const palette = useCommandPalette();
  const opened = useCommandPaletteOpen();
  const [Dialog, setDialog] = useState<ComponentType<CommandPaletteProps>>();
  const failureMessage = t`The action could not be completed. Please try again.`;
  useEffect(() => {
    if (!opened || Dialog) return;
    void import("./command-palette-dialog.tsx").then(
      ({ CommandPaletteDialog }) => setDialog(() => CommandPaletteDialog),
      (error: unknown) => {
        console.error(error);
        notifyError({ message: failureMessage });
        palette.finished();
      },
    );
  }, [opened, Dialog, failureMessage, palette]);
  return Dialog ? <Dialog {...props} /> : null;
}
