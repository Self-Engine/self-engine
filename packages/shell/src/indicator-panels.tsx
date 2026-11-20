import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ShellContribution } from "./contributions.ts";
import type { OpenIndicatorPanel } from "./module-indicator.ts";

/** One opening of a module's Indicator Panel. Each opening counts, also one of the same panel. */
export interface PanelOpening {
  readonly moduleId: string;
  readonly opening: number;
}

/** Answers whether a panel's unsaved changes may go, asking the person first if there are any. */
type ConfirmDiscard = () => Promise<boolean>;

/**
 * Which Indicator Panel is open: at most one, and none after a reload. It lives beside the Shell
 * rather than in a component, so that a function of the Shell can open a panel from anywhere and
 * only the place whose panel opens or closes draws again, never the page.
 */
function createIndicatorPanels() {
  let open: PanelOpening | undefined;
  let openings = 0;
  const listeners = new Set<() => void>();
  // Each panel's frame holds the checks of its content, and so the question.
  const questions = new Map<string, ConfirmDiscard>();
  let leaving: Promise<boolean> | undefined;
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
    /** The frame of the module's panel tells how to ask before its unsaved changes go. */
    askBeforeLeaving: (moduleId: string, confirmDiscard: ConfirmDiscard) => {
      questions.set(moduleId, confirmDiscard);
      return () => {
        if (questions.get(moduleId) === confirmDiscard) questions.delete(moduleId);
      };
    },
    /**
     * Whether the open panel may be left: asks when its content reports unsaved changes. Closes
     * nothing, for a change of page, which closes the panel once the new page is on screen.
     */
    confirmLeave: async () =>
      open === undefined ? true : ((await questions.get(open.moduleId)?.()) ?? true),
    /**
     * The one way out of a panel, which every way but "done" takes: Escape, a click outside, a
     * second click on the indicator, cancel from the content and another panel. Asks first when
     * the content reports unsaved changes, and answers whether the panel was left.
     */
    leave: (): Promise<boolean> => {
      if (open === undefined) return Promise.resolve(true);
      // One question for every attempt at once: a click on another indicator is a click outside
      // as well, and opens that panel once this one is left.
      leaving ??= (async () => {
        const left = open;
        try {
          if (!(await panels.confirmLeave())) return false;
          if (open === left) set(undefined);
          return true;
        } finally {
          leaving = undefined;
        }
      })();
      return leaving;
    },
    /** Closes the panel without asking, once the page it was asked about is gone. */
    close: () => {
      if (open !== undefined) set(undefined);
    },
    /** "Done" from the content of the opening `opening` names: closes it, if it is still open. */
    finish: (opening: number) => {
      if (panels.isOpen(opening)) set(undefined);
    },
    /** Opens the module's panel, leaving the one that is open, which may ask first. */
    open: async (moduleId: string) => {
      if (open?.moduleId === moduleId) return;
      if (!(await panels.leave())) return;
      // Another way may have opened a panel while the question was open.
      if (open !== undefined) return;
      openings += 1;
      set({ moduleId, opening: openings });
    },
    /** What a click on the indicator does: opens its panel, or leaves it when it is open. */
    toggle: (moduleId: string) => {
      void (open?.moduleId === moduleId ? panels.leave() : panels.open(moduleId));
    },
  };
  return panels;
}

export type IndicatorPanels = ReturnType<typeof createIndicatorPanels>;

interface IndicatorPanelsContextValue {
  readonly panels: IndicatorPanels;
  readonly openIndicatorPanel: OpenIndicatorPanel;
}

const IndicatorPanelsContext = createContext<IndicatorPanelsContextValue | null>(null);

interface IndicatorPanelsProviderProps {
  /** The modules whose panels a Command or a Notice may open. */
  readonly modules: readonly ShellContribution[];
  /**
   * Names the page on screen: a change of it closes the open panel, whose frame asked first
   * through the leave guard while the address changed.
   */
  readonly page: string;
  readonly children: ReactNode;
}

/** Once per Shell. */
export function IndicatorPanelsProvider({ modules, page, children }: IndicatorPanelsProviderProps) {
  const [panels] = useState(createIndicatorPanels);
  // Before the paint, so the new page never shows the panel of the one before.
  useLayoutEffect(() => panels.close(), [panels, page]);
  // The latest modules, read when called, so the function stays one for the Shell's life.
  const known = useRef(modules);
  useLayoutEffect(() => {
    known.current = modules;
    // A module that left the module list took its panel along: its opening ends, so the panel
    // does not open by itself should the module return.
    const open = panels.current();
    const stillThere = (module: ShellContribution) =>
      module.id === open?.moduleId && module.indicator?.panel !== undefined;
    if (open !== undefined && !modules.some(stillThere)) panels.close();
  }, [panels, modules]);
  const [value] = useState<IndicatorPanelsContextValue>(() => ({
    panels,
    openIndicatorPanel: (indicator) => {
      const module = known.current.find((candidate) => candidate.indicator === indicator);
      if (module === undefined) throw new Error("This indicator belongs to no module of the Shell");
      void panels.open(module.id);
    },
  }));
  return <IndicatorPanelsContext value={value}>{children}</IndicatorPanelsContext>;
}

function useIndicatorPanelsContext(): IndicatorPanelsContextValue {
  const value = useContext(IndicatorPanelsContext);
  if (value === null) throw new Error("An Indicator Panel needs the Shell");
  return value;
}

export function useIndicatorPanels(): IndicatorPanels {
  return useIndicatorPanelsContext().panels;
}

/**
 * The Shell's function that opens a module's Indicator Panel, for code inside the Shell, such as
 * a View that shows a Notice whose action leads to the panel. A Command is given it in its
 * context. Stable for the Shell's life.
 */
export function useOpenIndicatorPanel(): OpenIndicatorPanel {
  return useIndicatorPanelsContext().openIndicatorPanel;
}

/** The opening of this module's panel while it is open, and nothing while another one is. */
export function useOpeningOf(moduleId: string): number | undefined {
  const panels = useIndicatorPanels();
  return useSyncExternalStore(panels.subscribe, () => {
    const open = panels.current();
    return open?.moduleId === moduleId ? open.opening : undefined;
  });
}
