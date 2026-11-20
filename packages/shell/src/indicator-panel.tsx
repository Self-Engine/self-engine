import { useLingui } from "@lingui/react/macro";
import { Drawer, Popover, rem } from "@mantine/core";
import { LoadingState, NOT_WINDOW_DRAG_STYLE } from "@self-engine/ui";
import {
  type ComponentType,
  type CSSProperties,
  type ReactElement,
  useEffect,
  useState,
} from "react";
import { useCommandPaletteOpen } from "./command-palette-state.tsx";
import type { IndicatorPanelProps, ShellContribution } from "./contributions.ts";
import { useEscapeExit } from "./edit-drawer-exits.tsx";
import { whenIdle } from "./idle.ts";
import { useIndicatorPanels, useOpeningOf } from "./indicator-panels.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";

type LoadPanel = () => Promise<{ readonly default: ComponentType<IndicatorPanelProps> }>;

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

// As tall as the content, up to most of the phone; taller content scrolls below the title.
const SHEET_STYLES = {
  content: { ...NOT_WINDOW_DRAG_STYLE, maxHeight: "70%" },
  overlay: NOT_WINDOW_DRAG_STYLE,
} satisfies Record<string, CSSProperties>;

const loadedPanels = lazyComponents<IndicatorPanelProps>();

/**
 * Loads the panel's code in an idle moment once the indicator's code has arrived, so the first
 * opening does not wait. `codeWanted` turns true when the Shell asks for the indicator's code.
 */
export function usePanelPreload(
  loadIndicator: () => Promise<unknown>,
  panel: LoadPanel | undefined,
  codeWanted: boolean,
): void {
  useEffect(() => {
    if (!codeWanted || panel === undefined) return undefined;
    let stop: (() => void) | undefined;
    let live = true;
    // The indicator's code is loaded or on its way, so this only waits for it to arrive.
    void loadIndicator().then(
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
  }, [codeWanted, loadIndicator, panel]);
}

interface IndicatorPanelFrameProps {
  readonly module: ShellContribution;
  readonly panel: LoadPanel;
  /** On the phone the panel is a sheet from below, on every other Layout Step a popover. */
  readonly sheet: boolean;
  /** The indicator's place, which the popover hangs below. */
  readonly children: ReactElement;
}

/**
 * The frame the Shell gives a module's Indicator Panel: the focus moves in on opening and back on
 * closing, and Escape, a click outside and a second click on the indicator close it. Only this
 * frame draws again when the panel opens or closes; the place it gets keeps its element.
 */
export function IndicatorPanelFrame({ module, panel, sheet, children }: IndicatorPanelFrameProps) {
  const { i18n, t } = useLingui();
  const panels = useIndicatorPanels();
  const paletteOpen = useCommandPaletteOpen();
  const openingNow = useOpeningOf(module.id);
  // The last opening stays while the frame fades out, so its content does not vanish first.
  const [shown, setShown] = useState(openingNow);
  if (openingNow !== undefined && openingNow !== shown) setShown(openingNow);
  const opened = openingNow !== undefined;
  // The Command Palette is a modal that listens on the window as well: while it is open, Esc is its.
  const popoverFrame = useEscapeExit(opened && !sheet && !paletteOpen, panels.leave);
  const sheetFrame = useEscapeExit(opened && sheet && !paletteOpen, panels.leave);
  const name = i18n._(module.name);
  const content = shown !== undefined && (
    <LazyContribution
      key={shown}
      components={loadedPanels}
      fallback={<LoadingState />}
      load={panel}
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
        closeOnClickOutside={!paletteOpen}
        closeOnEscape={false}
        onChange={(next) => {
          if (!next) panels.leave();
        }}
        opened={opened && !sheet}
        position="bottom-end"
        returnFocus
        shadow="md"
        trapFocus
        width={INDICATOR_PANEL_WIDTH}
        // The place is no control of its own; the indicator's buttons are.
        withRoles={false}
      >
        <Popover.Target>{children}</Popover.Target>
        <Popover.Dropdown
          aria-label={name}
          data-color-set={module.color}
          ref={popoverFrame}
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
