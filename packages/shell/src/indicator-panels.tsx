import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

/** One opening of a module's Indicator Panel. Each opening counts, also one of the same panel. */
export interface PanelOpening {
  readonly moduleId: string;
  readonly opening: number;
}

/**
 * Which Indicator Panel is open: at most one, and none after a reload. It lives beside the Shell
 * rather than in a component, so that a function of the Shell can open a panel from anywhere and
 * only the place whose panel opens or closes draws again, never the page.
 */
function createIndicatorPanels() {
  let open: PanelOpening | undefined;
  let openings = 0;
  const listeners = new Set<() => void>();
  const set = (next: PanelOpening | undefined) => {
    open = next;
    for (const listener of listeners) listener();
  };
  const panels = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** The opening on screen now, at the moment it is asked. */
    current: () => open,
    /** Whether the opening `opening` names is still the open one. */
    isOpen: (opening: number) => open?.opening === opening,
    /**
     * The one way out of a panel, which every way but "done" takes: Escape, a click outside, a
     * second click on the indicator, cancel from the content, another panel and a change of page.
     */
    leave: () => {
      if (open !== undefined) set(undefined);
    },
    /** "Done" from the content of the opening `opening` names: closes it, if it is still open. */
    finish: (opening: number) => {
      if (panels.isOpen(opening)) set(undefined);
    },
    /** Opens the module's panel, leaving the one that is open. */
    open: (moduleId: string) => {
      if (open?.moduleId === moduleId) return;
      panels.leave();
      openings += 1;
      set({ moduleId, opening: openings });
    },
    /** What a click on the indicator does: opens its panel, or leaves it when it is open. */
    toggle: (moduleId: string) => {
      if (open?.moduleId === moduleId) panels.leave();
      else panels.open(moduleId);
    },
  };
  return panels;
}

export type IndicatorPanels = ReturnType<typeof createIndicatorPanels>;

const IndicatorPanelsContext = createContext<IndicatorPanels | null>(null);

interface IndicatorPanelsProviderProps {
  /** Names the page on screen: a change of it leaves the open panel. */
  readonly page: string;
  readonly children: ReactNode;
}

/** Once per Shell. */
export function IndicatorPanelsProvider({ page, children }: IndicatorPanelsProviderProps) {
  const [panels] = useState(createIndicatorPanels);
  // Before the paint, so the new page never shows the panel of the one before.
  useLayoutEffect(() => panels.leave(), [panels, page]);
  return <IndicatorPanelsContext value={panels}>{children}</IndicatorPanelsContext>;
}

export function useIndicatorPanels(): IndicatorPanels {
  const panels = useContext(IndicatorPanelsContext);
  if (panels === null) throw new Error("An Indicator Panel needs the Shell");
  return panels;
}

/** The opening of this module's panel while it is open, and nothing while another one is. */
export function useOpeningOf(moduleId: string): number | undefined {
  const panels = useIndicatorPanels();
  return useSyncExternalStore(panels.subscribe, () => {
    const open = panels.current();
    return open?.moduleId === moduleId ? open.opening : undefined;
  });
}
