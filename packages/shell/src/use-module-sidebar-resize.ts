import { clamp, type SplitterPaneSize } from "@mantine/hooks";
import { type MouseEvent, useRef, useState } from "react";

const MODULE_SIDEBAR_MIN_WIDTH = 200;
const MODULE_SIDEBAR_MAX_WIDTH = 360;
export const SHELL_STANDARD_MODULE_SIDEBAR_WIDTH = 240;
/** The same steps as Mantine's Navbar handle. */
const KEYBOARD_STEP = 10;
const KEYBOARD_SHIFT_STEP = 50;

interface UseModuleSidebarResizeInput {
  readonly width: number;
  /** Whether the Layout Step and the user show it. Its pane stays either way, at no width. */
  readonly shown: boolean;
  /** Mantine's `theme.scale`. */
  readonly scale: number;
  readonly onCommit: ((width: number) => void) | undefined;
}

/** The Module Sidebar's handle: a drag previews, and a change is reported once, at its end. */
export function useModuleSidebarResize({
  width,
  shown,
  scale,
  onCommit,
}: UseModuleSidebarResizeInput) {
  // `Splitter` resolves sizes without Mantine's scale, so widths are converted here, once.
  const paneSize = (unscaled: number): `${number}px` => `${unscaled * scale}px`;
  const shownWidth = clamp(width, MODULE_SIDEBAR_MIN_WIDTH, MODULE_SIDEBAR_MAX_WIDTH);
  const [draggedPaneSize, setDraggedPaneSize] = useState<SplitterPaneSize | null>(null);
  const dragging = useRef(false);
  const currentPaneSize = shown ? (draggedPaneSize ?? paneSize(shownWidth)) : "0px";

  const commitWidth = (next: number) => {
    if (next !== shownWidth) onCommit?.(next);
  };
  const commitPaneSize = (size: SplitterPaneSize | undefined) => {
    commitWidth(Math.round(Number.parseFloat(String(size)) / scale));
  };

  return {
    shownWidth,
    paneProps: {
      defaultSize: currentPaneSize,
      max: paneSize(MODULE_SIDEBAR_MAX_WIDTH),
      min: paneSize(MODULE_SIDEBAR_MIN_WIDTH),
    },
    splitterProps: {
      // Below, because Mantine's reset restores the ratio of the panes, not the standard width.
      resetOnDoubleClick: false,
      onDoubleClick: (event: MouseEvent<HTMLElement>) => {
        // The pointer mostly hits the thumb inside the handle. Only this Splitter's own handle
        // counts, not a separator in a pane or a nested Splitter's.
        const handle = (event.target as Element).closest('[role="separator"]');
        if (handle?.parentElement === event.currentTarget)
          commitWidth(SHELL_STANDARD_MODULE_SIDEBAR_WIDTH);
      },
      onResizeEnd: (_: number, sizes: SplitterPaneSize[]) => {
        dragging.current = false;
        setDraggedPaneSize(null);
        commitPaneSize(sizes[0]);
      },
      onResizeStart: () => {
        dragging.current = true;
      },
      // A key press reaches only this callback, a drag ends in `onResizeEnd`.
      onSizeChange: (sizes: SplitterPaneSize[]) => {
        if (dragging.current) setDraggedPaneSize(sizes[0] ?? null);
        else commitPaneSize(sizes[0]);
      },
      shiftStep: paneSize(KEYBOARD_SHIFT_STEP),
      sizes: [currentPaneSize, 100],
      step: paneSize(KEYBOARD_STEP),
    },
  };
}
