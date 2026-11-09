import { rem, useAppShellResize } from "@mantine/core";
import { useRef, useState } from "react";
import {
  collapseMidpointOf,
  NAVBAR_MAX_WIDTH,
  type NavbarLimits,
  settledNavbar,
  type ShellNavbarState,
  shownWidthOf,
} from "./navbar-geometry.ts";

/** The variables Mantine's handle writes in `static` mode, and removes again on its own. */
const NAVBAR_PREVIEW_VARIABLES = ["--app-shell-navbar-width", "--app-shell-navbar-grid-width"];

interface UseNavbarResizeInput {
  readonly navbar: ShellNavbarState;
  readonly limits: NavbarLimits;
  /** Already translated. */
  readonly label: string;
  readonly onCommit: ((navbar: ShellNavbarState) => void) | undefined;
}

/** The Navbar's handle: it settles on the two forms and reports a change once, at its end. */
export function useNavbarResize({ navbar, limits, label, onCommit }: UseNavbarResizeInput) {
  // Set only during a drag, so the commit on release is still the one report of a change.
  const [draggedCollapsed, setDraggedCollapsed] = useState<boolean | null>(null);
  const appShellRef = useRef<HTMLDivElement>(null);

  const commit = (next: ShellNavbarState) => {
    if (next.collapsed !== navbar.collapsed || next.expandedWidth !== navbar.expandedWidth)
      onCommit?.(next);
  };

  const resize = useAppShellResize({
    navbar: {
      min: limits.iconsOnlyWidth,
      max: NAVBAR_MAX_WIDTH,
      label,
      collapseThreshold: collapseMidpointOf(limits),
    },
    onCollapseChange: (_, collapsed) => setDraggedCollapsed(collapsed),
    // Runs right after Mantine wrote the pointer's width, and only the gap needs correcting.
    onResize: ({ navbar: width }) => {
      if (width === undefined || width >= limits.minWideWidth) return;
      const shown = rem(shownWidthOf(settledNavbar(width, navbar, true, limits), limits));
      for (const variable of NAVBAR_PREVIEW_VARIABLES)
        appShellRef.current?.style.setProperty(variable, shown);
    },
    onResizeEnd: ({ navbar: width }) => {
      if (width === undefined) return;
      commit(settledNavbar(width, navbar, resize.activeSection === "navbar", limits));
    },
  });

  // Our props are the truth: Mantine would otherwise prefer the size it remembers from a drag.
  const shownWidth = shownWidthOf(navbar, limits);
  const controlledResize = {
    ...resize,
    // Every way out of a resize passes here: release, Escape, a key press.
    endResize: (...args: Parameters<typeof resize.endResize>) => {
      setDraggedCollapsed(null);
      resize.endResize(...args);
    },
    sizes: { navbar: shownWidth },
    navbar: {
      ...resize.navbar,
      size: shownWidth,
      // Mantine calls this on a double-click, to go back to the configured width.
      reset: () => commit({ ...navbar, collapsed: !navbar.collapsed }),
    },
  };

  return {
    appShellRef,
    /** The form on screen, which a drag changes before its commit. */
    collapsed: draggedCollapsed ?? navbar.collapsed,
    resize: controlledResize,
    shownWidth,
  };
}
