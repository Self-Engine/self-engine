// The frame of an Indicator Panel. A chunk of its own, which the Shell loads in the idle moment
// after the first paint together with the indicators, so that Mantine's Popover and its
// positioning stay out of the start.

import { useLingui } from "@lingui/react/macro";
import { Box, Drawer, Popover, rem } from "@mantine/core";
import { useClickOutside, useMergedRef } from "@mantine/hooks";
import { LoadingState, NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import { type CSSProperties, useEffect, useState } from "react";
import { useCommandPaletteOpen } from "./command-palette-state.tsx";
import type {
  IndicatorPanelProps,
  IndicatorWithPanel,
  ShellContribution,
} from "./contributions.ts";
import { useEscapeExit } from "./edit-drawer-exits.tsx";
import { whenIdle } from "./idle.ts";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";

/** The popover's width on the wide, medium and narrow step, in unscaled pixels. */
export const INDICATOR_PANEL_WIDTH = 320;
/** Taller content scrolls inside the popover. */
const POPOVER_MAX_HEIGHT = 480;

// It reaches into the content header, whose drag region would swallow the clicks.
const DROPDOWN_STYLE: CSSProperties = {
  ...NOT_WINDOW_DRAG_STYLE,
  maxHeight: rem(POPOVER_MAX_HEIGHT),
  overflowY: "auto",
};

// What the popover hangs below: the place itself, without taking a click or a pixel of it.
const ANCHOR_STYLE: CSSProperties = { inset: 0, pointerEvents: "none", position: "absolute" };

// As tall as the content, up to most of the phone; taller content scrolls below the title.
const SHEET_STYLES = {
  content: { ...NOT_WINDOW_DRAG_STYLE, maxHeight: "70%" },
  overlay: NOT_WINDOW_DRAG_STYLE,
} satisfies Record<string, CSSProperties>;

export interface IndicatorPanelFrameProps {
  readonly module: ShellContribution;
  readonly indicator: IndicatorWithPanel;
  /** On the phone the panel is a sheet from below, on every other Layout Step a popover. */
  readonly sheet: boolean;
  /** The indicator's place, which the popover hangs below and whose clicks are not outside. */
  readonly place: HTMLElement | null;
}

const loadedPanels = lazyComponents<IndicatorPanelProps>();

/**
 * Loads the panel's code in an idle moment once the indicator's code has arrived, so the first
 * opening does not wait.
 */
function usePanelPreload({ load, panel }: IndicatorPanelFrameProps["indicator"]): void {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let live = true;
    // The indicator's code is loaded or on its way, so this only waits for it to arrive.
    void load().then(
      () => {
        if (live) stop = whenIdle(() => loadedPanels.preload(panel));
      },
      () => {
        // The indicator shows its own failure; its panel cannot open without it.
      },
    );
    return () => {
      live = false;
      stop?.();
    };
  }, [load, panel]);
}

/**
 * The frame the Shell gives a module's Indicator Panel: a popover below the place, or a sheet
 * from below on the phone. The focus moves in on opening and back on closing; Escape, a click
 * outside and a second click on the indicator close it. Only this frame draws again when the
 * panel opens or closes, never the indicator beside it.
 */
export default function IndicatorPanelFrame({
  module,
  indicator,
  sheet,
  place,
}: IndicatorPanelFrameProps) {
  const { i18n, t } = useLingui();
  const panels = useIndicatorPanels();
  const paletteOpen = useCommandPaletteOpen();
  usePanelPreload(indicator);
  const openingNow = useOpeningOf(module.id);
  // The last opening stays while the frame fades out, so its content does not vanish first.
  const [shown, setShown] = useState(openingNow);
  if (openingNow !== undefined && openingNow !== shown) setShown(openingNow);
  const opened = openingNow !== undefined;
  // The Command Palette is a modal that listens on the window as well: while it is open, Esc and
  // a click are its.
  const popoverEscape = useEscapeExit(opened && !sheet && !paletteOpen, panels.leave);
  const sheetFrame = useEscapeExit(opened && sheet && !paletteOpen, panels.leave);
  const [dropdown, setDropdown] = useState<HTMLDivElement | null>(null);
  const dropdownRef = useMergedRef(popoverEscape, setDropdown);
  // A click on the place is the indicator's own: a second click on it closes through its toggle.
  useClickOutside(
    () => {
      if (opened && !sheet && !paletteOpen) panels.leave();
    },
    null,
    [place, dropdown],
  );
  const name = i18n._(module.name);
  const content = shown !== undefined && (
    <LazyContribution
      key={shown}
      components={loadedPanels}
      fallback={<LoadingState />}
      load={indicator.panel}
      props={{
        // Bound to the opening the content was mounted for: a call that comes after the person
        // left it closes nothing that is open now.
        onCancel: () => {
          if (panels.isOpen(shown)) panels.leave();
        },
        onDone: () => panels.finish(shown),
        isOpen: () => panels.isOpen(shown),
      }}
    />
  );
  return (
    <>
      <Popover
        closeOnClickOutside={false}
        closeOnEscape={false}
        opened={opened && !sheet}
        position="bottom-end"
        returnFocus
        shadow="md"
        trapFocus
        width={INDICATOR_PANEL_WIDTH}
        // The place is no control of its own; the indicator's buttons are.
        withRoles={false}
      >
        <Popover.Target>
          <Box aria-hidden style={ANCHOR_STYLE} />
        </Popover.Target>
        <Popover.Dropdown
          aria-label={name}
          data-color-set={module.color}
          ref={dropdownRef}
          role="dialog"
          style={DROPDOWN_STYLE}
          tabIndex={-1}
        >
          {!sheet && content}
        </Popover.Dropdown>
      </Popover>
      <Drawer
        closeButtonProps={{ "aria-label": t`Close panel` }}
        closeOnEscape={false}
        data-color-set={module.color}
        onClose={panels.leave}
        opened={opened && sheet}
        position="bottom"
        ref={sheetFrame}
        size="auto"
        styles={SHEET_STYLES}
        title={name}
      >
        {sheet && content}
      </Drawer>
    </>
  );
}
