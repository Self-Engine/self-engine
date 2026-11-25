// The frame of an Indicator Panel. A chunk of its own, which the Shell loads in the idle moment
// after the first paint together with the indicators, so that Mantine's Popover and its
// positioning stay out of the start.

import { useLingui } from "@lingui/react/macro";
import { Box, Drawer, Popover, rem } from "@mantine/core";
import { useClickOutside, useDidUpdate, useMergedRef, useWindowEvent } from "@mantine/hooks";
import { NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useCommandPaletteOpen } from "./command-palette-state.tsx";
import type { ModuleWithIndicator } from "./contributions.ts";
import type { IndicatorPanelProps, IndicatorWithPanel } from "./module-indicator.ts";
import { whenIdle } from "./idle.ts";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import { lazyComponents } from "./lazy-contribution.tsx";
import { type LeaveGuard, useShellRouting } from "./routing.tsx";
import { FOCUSABLE } from "./focusable.ts";
import { FrameContent, openEditDrawer, useDiscardQuestion, useEscapeExit } from "./frame-exits.tsx";

/** The popover's width on the wide, medium and narrow step, in unscaled pixels. */
export const INDICATOR_PANEL_WIDTH = 320;
/** Taller content scrolls inside the popover. */
const POPOVER_MAX_HEIGHT = 480;

// It reaches into the Shell's header, whose drag region would swallow the clicks.
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
  readonly module: ModuleWithIndicator<IndicatorWithPanel>;
  /**
   * On the phone the panel is a sheet from below, on every other Layout Step a popover. An opening
   * keeps the kind it opened in until it closes.
   */
  readonly sheet: boolean;
  /** The indicator's place, which the popover hangs below and whose clicks are not outside. */
  readonly place: HTMLElement | null;
  /** Whether the indicator's code is on screen: from then on its panel's code preloads. */
  readonly indicatorShown: boolean;
}

const loadedPanels = lazyComponents<IndicatorPanelProps>();

/**
 * Loads the panel's code in an idle moment once the indicator's code is on screen, also after a
 * retry, so the first opening does not wait.
 */
function usePanelPreload(panel: IndicatorWithPanel["panel"], indicatorShown: boolean): void {
  useEffect(
    () => (indicatorShown ? whenIdle(() => loadedPanels.preload(panel)) : undefined),
    [panel, indicatorShown],
  );
}

/**
 * Puts the focus back on the indicator when the panel closes, however it opened: on the control
 * that opened it, or on the indicator's first control when a Command or a Notice opened it. Mantine's
 * own return goes to whatever had the focus at the opening, such as the Command Palette's field.
 * Its rule of when to return stays: only when the focus is nowhere or has not moved since closing.
 *
 * While the Edit Drawer is open, its overlay covers the indicator, and the drawer hears Escape
 * only with the focus inside it. So the focus goes into the drawer then: where it last was there,
 * or on the drawer's first control.
 */
function useFocusBackToTheIndicator(opened: boolean, place: HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);
  const lastInDrawer = useRef<HTMLElement | null>(null);
  useWindowEvent("focusin", ({ target }) => {
    if (target instanceof HTMLElement && openEditDrawer()?.contains(target)) {
      lastInDrawer.current = target;
    }
  });
  useDidUpdate(() => {
    const focused = document.activeElement;
    if (opened) {
      opener.current = focused instanceof HTMLElement && place?.contains(focused) ? focused : null;
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      const now = document.activeElement;
      if (now !== null && now !== document.body && now !== focused) return;
      const drawer = openEditDrawer();
      const inDrawer = drawer?.contains(lastInDrawer.current)
        ? lastInDrawer.current
        : drawer?.querySelector<HTMLElement>(FOCUSABLE);
      const indicator = opener.current?.isConnected
        ? opener.current
        : place?.querySelector<HTMLElement>(FOCUSABLE);
      (drawer ? inDrawer : indicator)?.focus({ preventScroll: true });
    }, 10);
    return () => window.clearTimeout(timeout);
  }, [opened]);
}

/**
 * Whether a press happened inside the panel, also in a layer one of its fields draws in a portal,
 * such as the calendar of a date field or the list of a Select: such a layer is outside the
 * panel's DOM, but its events pass through the panel's React tree. React hears a press before
 * the document does, so the check of a click outside finds it marked.
 */
function usePressInside() {
  const lastInside = useRef<Event | null>(null);
  const mark = (event: { readonly nativeEvent: Event }) => {
    lastInside.current = event.nativeEvent;
  };
  return {
    handlers: { onMouseDownCapture: mark, onTouchStartCapture: mark },
    wasInside: (event: Event) => event === lastInside.current,
  };
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
    ({ current, next }) => current.pathname === next.pathname || panels.confirmLeave(),
    [panels],
  );
  useShellRouting().useLeaveGuard(guard, opened);
  return question;
}

/**
 * The frame the Shell gives a module's Indicator Panel: a popover below the place, or a sheet
 * from below on the phone. The focus moves in on opening and back to the indicator on closing; Escape, a click
 * outside and a second click on the indicator close it, asking first when the content reports
 * unsaved changes.
 */
export default function IndicatorPanelFrame({
  module,
  sheet: sheetAtThisStep,
  place,
  indicatorShown,
}: IndicatorPanelFrameProps) {
  const { i18n, t } = useLingui();
  const panels = useIndicatorPanels();
  const paletteOpen = useCommandPaletteOpen();
  usePanelPreload(module.indicator.panel, indicatorShown);
  const openingNow = useOpeningOf(module.id);
  // The last opening stays while the frame fades out, so its content does not vanish first. Its
  // frame stays the kind it opened in: content that moved between the popover and the sheet when
  // the window crosses the phone border would mount anew and lose what the person typed.
  const [shownOpening, setShownOpening] = useState(
    openingNow === undefined ? undefined : { opening: openingNow, sheet: sheetAtThisStep },
  );
  if (openingNow !== undefined && openingNow !== shownOpening?.opening) {
    setShownOpening({ opening: openingNow, sheet: sheetAtThisStep });
  }
  const shown = shownOpening?.opening;
  const sheet = shownOpening?.sheet ?? sheetAtThisStep;
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
  useFocusBackToTheIndicator(opened, place);
  const pressInside = usePressInside();
  // A click on the place is the indicator's own: a second click on it leaves through its toggle.
  useClickOutside(
    (event) => {
      if (listening && !sheet && !pressInside.wasInside(event)) leave();
    },
    null,
    [place, dropdown],
  );
  const name = i18n._(module.name);
  const content = shown !== undefined && (
    <FrameContent
      components={loadedPanels}
      load={module.indicator.panel}
      opening={shown}
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
      register={question.register}
    />
  );
  return (
    <>
      <Popover
        closeOnClickOutside={false}
        closeOnEscape={false}
        opened={opened && !sheet}
        position="bottom-end"
        returnFocus={false}
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
          {...pressInside.handlers}
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
        returnFocus={false}
        size="auto"
        styles={SHEET_STYLES}
        title={name}
      >
        {sheet && content}
      </Drawer>
    </>
  );
}
