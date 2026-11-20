// The frame of an Indicator Panel. A chunk of its own, which the Shell loads in the idle moment
// after the first paint together with the indicators, so that Mantine's Popover and its
// positioning stay out of the start.

import { useLingui } from "@lingui/react/macro";
import { Box, Drawer, Popover, rem } from "@mantine/core";
import { useClickOutside, useMergedRef, useWindowEvent } from "@mantine/hooks";
import { LoadingState, NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useCommandPaletteOpen } from "./command-palette-state.tsx";
import type { ShellContribution } from "./contributions.ts";
import type { IndicatorPanelProps, IndicatorWithPanel } from "./module-indicator.ts";
import { useEscapeExit } from "./edit-drawer-exits.tsx";
import { whenIdle } from "./idle.ts";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";
import { type LeaveGuard, useShellRouting } from "./routing.tsx";
import { UnsavedChangesContext, useDiscardQuestion } from "./unsaved-changes.tsx";

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
 * The question before the content's unsaved changes are lost, for every way out but "done", and
 * for a change of page. "Keep editing" returns the focus to where it was in the panel: a click on
 * the indicator or outside may have taken it out before the question opened.
 */
function usePanelQuestion(moduleId: string, opened: boolean, frameOf: () => HTMLElement | null) {
  const panels = useIndicatorPanels();
  const lastFocusInside = useRef<HTMLElement | null>(null);
  useWindowEvent("focusin", (event) => {
    if (event.target instanceof HTMLElement && frameOf()?.contains(event.target)) {
      lastFocusInside.current = event.target;
    }
  });
  const question = useDiscardQuestion((focused) => {
    if (focused instanceof HTMLElement && frameOf()?.contains(focused)) return focused;
    return lastFocusInside.current?.isConnected ? lastFocusInside.current : frameOf();
  });
  const { confirmDiscard } = question;
  useEffect(
    () => panels.askBeforeLeaving(moduleId, confirmDiscard),
    [panels, moduleId, confirmDiscard],
  );
  // A change of the search on the same page, such as a filter or the Edit Drawer, keeps the panel.
  const guard = useCallback<LeaveGuard>(
    ({ current, next }) => current.pathname === next.pathname || confirmDiscard(),
    [confirmDiscard],
  );
  useShellRouting().useLeaveGuard(guard, opened);
  return question;
}

/**
 * The frame the Shell gives a module's Indicator Panel: a popover below the place, or a sheet
 * from below on the phone. The focus moves in on opening and back on closing; Escape, a click
 * outside and a second click on the indicator close it, asking first when the content reports
 * unsaved changes.
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
  const [sheetNode, setSheetNode] = useState<HTMLDivElement | null>(null);
  const [dropdown, setDropdown] = useState<HTMLDivElement | null>(null);
  const question = usePanelQuestion(module.id, opened, () => (sheet ? sheetNode : dropdown));
  const leave = () => void panels.leave();
  // The Command Palette and the question are modals that listen on the window as well: while one
  // is open, Esc and a click are theirs.
  const listening = opened && !paletteOpen && !question.questionOpen;
  const popoverEscape = useEscapeExit(listening && !sheet, leave);
  const sheetFrame = useEscapeExit(listening && sheet, leave);
  // Stable refs: Mantine's focus trap moves the focus into the panel each time its ref changes.
  const dropdownRef = useMergedRef(popoverEscape, setDropdown);
  const sheetRef = useMergedRef(sheetFrame, setSheetNode);
  // A click on the place is the indicator's own: a second click on it leaves through its toggle.
  useClickOutside(
    () => {
      if (listening && !sheet) leave();
    },
    null,
    [place, dropdown],
  );
  const name = i18n._(module.name);
  const content = shown !== undefined && (
    <UnsavedChangesContext value={question.register}>
      <LazyContribution
        key={shown}
        components={loadedPanels}
        fallback={<LoadingState />}
        load={indicator.panel}
        props={{
          // Bound to the opening the content was mounted for: a call that comes after the
          // person left it closes nothing that is open now.
          onCancel: () => {
            if (panels.isOpen(shown)) leave();
          },
          onDone: () => panels.finish(shown),
          confirmDiscard: question.confirmDiscard,
          isOpen: () => panels.isOpen(shown),
        }}
      />
    </UnsavedChangesContext>
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
        onClose={leave}
        opened={opened && sheet}
        position="bottom"
        ref={sheetRef}
        size="auto"
        styles={SHEET_STYLES}
        title={name}
      >
        {sheet && content}
      </Drawer>
    </>
  );
}
