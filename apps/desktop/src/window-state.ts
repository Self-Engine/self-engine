// The Window State (GLOSSARY.md): where the desktop window was, how big, and whether it was
// maximized or in full screen, kept per channel in one file in the channel's data folder (D114,
// D206–D208). It is not a Setting. Free of `electron` so it can be tested in Node; `main.ts`
// only wires it up.

import { readFileSync, renameSync, writeFileSync } from "node:fs";

/** A rectangle in screen coordinates; width and height are the page's size (`useContentSize`). */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Display {
  /** The part of the display a window may use, without the menu bar, Dock or task bar. */
  readonly workArea: Bounds;
  /** Whether this is the main display. */
  readonly main: boolean;
}

/** The window as the main process reports it. */
export interface WindowSnapshot {
  /** The bounds the window has when it is neither maximized nor in full screen. */
  readonly bounds: Bounds;
  readonly maximized: boolean;
  readonly fullScreen: boolean;
}

/** How to open the window. */
export interface WindowOpening {
  readonly bounds: Bounds;
  readonly maximize: boolean;
  readonly fullScreen: boolean;
}

export interface WindowStateRecorder {
  /** Reports a move, a resize, or a change of maximized or full screen. */
  change(snapshot: WindowSnapshot): void;
  /** Reports the window closing; writes at once. */
  close(snapshot: WindowSnapshot): void;
}

export type Scheduler = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

const FORMAT_VERSION = 1;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
/** The page's minimum width, below which the phone Layout Step would appear (D131). */
export const MINIMUM_WIDTH = 576;
/** How long the window must stay unchanged before its state is written. */
export const WRITE_DELAY_MS = 500;

interface StoredState {
  readonly version: typeof FORMAT_VERSION;
  readonly bounds: Bounds;
  readonly maximized: boolean;
  readonly fullScreen: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBounds(value: unknown): value is Bounds {
  if (!isRecord(value)) return false;
  const { x, y, width, height } = value;
  return (
    [x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    (width as number) > 0 &&
    (height as number) > 0
  );
}

/** The stored state, or undefined for a missing, damaged or unknown file. */
function readState(file: string): StoredState | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // A missing or damaged file opens the default window; it is never worth failing a start.
    return undefined;
  }
  if (!isRecord(parsed) || parsed.version !== FORMAT_VERSION) return undefined;
  const { bounds, maximized, fullScreen } = parsed;
  if (!isBounds(bounds) || typeof maximized !== "boolean" || typeof fullScreen !== "boolean") {
    return undefined;
  }
  return { version: FORMAT_VERSION, bounds, maximized, fullScreen };
}

function overlapArea(a: Bounds, b: Bounds): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function mainDisplay(displays: readonly Display[]): Display {
  const main = displays.find((display) => display.main) ?? displays[0];
  if (main === undefined) throw new Error("The window cannot open without a display.");
  return main;
}

/** The display showing most of the bounds, or undefined if none shows any of them. */
function displayShowing(bounds: Bounds, displays: readonly Display[]): Display | undefined {
  let best: Display | undefined;
  let bestArea = 0;
  for (const display of displays) {
    const area = overlapArea(bounds, display.workArea);
    if (area > bestArea) {
      best = display;
      bestArea = area;
    }
  }
  return best;
}

// The width never goes below the minimum, even on a work area narrower than that.
function fitSize(width: number, height: number, area: Bounds) {
  return {
    width: Math.round(Math.max(MINIMUM_WIDTH, Math.min(width, area.width))),
    height: Math.round(Math.min(height, area.height)),
  };
}

function centered(width: number, height: number, area: Bounds): Bounds {
  const size = fitSize(width, height, area);
  return {
    x: Math.round(area.x + (area.width - size.width) / 2),
    y: Math.round(area.y + (area.height - size.height) / 2),
    ...size,
  };
}

// Shrunk to the work area and moved into it, so that every edge and the window buttons can be
// reached.
function inside(bounds: Bounds, area: Bounds): Bounds {
  const size = fitSize(bounds.width, bounds.height, area);
  const clamp = (value: number, start: number, room: number) =>
    Math.round(Math.max(start, Math.min(value, start + room)));
  return {
    x: clamp(bounds.x, area.x, area.width - size.width),
    y: clamp(bounds.y, area.y, area.height - size.height),
    ...size,
  };
}

/**
 * Open: how the window opens, from the remembered state and the displays connected now. Nothing
 * usable remembered gives the default 1280 × 800 window on the main display; remembered bounds no
 * display shows keep their size but move to the middle of the main display (D207).
 */
export function openWindowState(file: string, displays: readonly Display[]): WindowOpening {
  const state = readState(file);
  if (state === undefined) {
    const area = mainDisplay(displays).workArea;
    return {
      bounds: centered(DEFAULT_WIDTH, DEFAULT_HEIGHT, area),
      maximize: false,
      fullScreen: false,
    };
  }
  const showing = displayShowing(state.bounds, displays);
  const bounds = showing
    ? inside(state.bounds, showing.workArea)
    : centered(state.bounds.width, state.bounds.height, mainDisplay(displays).workArea);
  return { bounds, maximize: state.maximized, fullScreen: state.fullScreen };
}

// Through a temporary file that is renamed over the real one, so that the file is always either
// the old or the new state.
function writeState(file: string, state: StoredState): void {
  const temporary = `${file}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(state)}\n`);
    renameSync(temporary, file);
  } catch (error) {
    // Losing the Window State costs a dragged window; interrupting the user would cost more.
    console.error("Self-Engine could not remember the window state", error);
  }
}

/**
 * Record: a recorder the main process reports every change of the window to. It writes about half
 * a second after the last change of a burst and at once when the window closes. The normal bounds
 * are kept while the window is maximized or in full screen, so that restoring and leaving full
 * screen return to them (D206).
 */
export function recordWindowState(file: string, scheduler: Scheduler): WindowStateRecorder {
  let normalBounds: Bounds | undefined;
  let pending: ReturnType<Scheduler["setTimeout"]> | undefined;
  let latest: StoredState | undefined;

  function remember(snapshot: WindowSnapshot): StoredState {
    if (normalBounds === undefined || (!snapshot.maximized && !snapshot.fullScreen)) {
      normalBounds = snapshot.bounds;
    }
    latest = {
      version: FORMAT_VERSION,
      bounds: normalBounds,
      maximized: snapshot.maximized,
      fullScreen: snapshot.fullScreen,
    };
    return latest;
  }

  function cancel(): void {
    if (pending !== undefined) scheduler.clearTimeout(pending);
    pending = undefined;
  }

  return {
    change(snapshot) {
      remember(snapshot);
      cancel();
      pending = scheduler.setTimeout(() => {
        pending = undefined;
        if (latest) writeState(file, latest);
      }, WRITE_DELAY_MS);
    },
    close(snapshot) {
      cancel();
      writeState(file, remember(snapshot));
    },
  };
}
