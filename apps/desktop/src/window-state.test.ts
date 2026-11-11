import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  type Bounds,
  type Display,
  MINIMUM_WIDTH,
  WRITE_DELAY_MS,
  type WindowSnapshot,
  openWindowState,
  recordWindowState,
} from "./window-state.ts";

// A laptop screen as the main display, below the menu bar, and an external monitor to its right.
const LAPTOP: Display = { workArea: { x: 0, y: 25, width: 1512, height: 920 }, main: true };
const MONITOR: Display = { workArea: { x: 1512, y: 0, width: 2560, height: 1415 }, main: false };
const BOTH = [LAPTOP, MONITOR];

const DEFAULT_ON_LAPTOP = {
  bounds: { x: 116, y: 85, width: 1280, height: 800 },
  maximize: false,
  fullScreen: false,
};

let folder: string;
let file: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "window-state-"));
  file = join(folder, "window-state.json");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(folder, { recursive: true, force: true });
});

function snapshot(bounds: Bounds, flags: Partial<WindowSnapshot> = {}): WindowSnapshot {
  return { bounds, maximized: false, fullScreen: false, ...flags };
}

// Writes a state the way a closing window does.
function remember(state: WindowSnapshot): void {
  recordWindowState(file, globalThis).close(state);
}

describe("openWindowState", () => {
  it("opens the default window centered on the main display when nothing is remembered", () => {
    expect(openWindowState(file, BOTH)).toEqual(DEFAULT_ON_LAPTOP);
  });

  it("opens the default window when the file is damaged", () => {
    writeFileSync(file, '{"version":1,"bounds":{"x":');
    expect(openWindowState(file, BOTH)).toEqual(DEFAULT_ON_LAPTOP);
  });

  it("opens the default window when the file has an unknown version", () => {
    writeFileSync(
      file,
      JSON.stringify({
        version: 2,
        bounds: { x: 10, y: 40, width: 900, height: 600 },
        maximized: false,
        fullScreen: false,
      }),
    );
    expect(openWindowState(file, BOTH)).toEqual(DEFAULT_ON_LAPTOP);
  });

  it("opens where the window was when a display still shows it", () => {
    const onMonitor = { x: 1800, y: 200, width: 1600, height: 1000 };
    remember(snapshot(onMonitor));
    expect(openWindowState(file, BOTH)).toEqual({
      bounds: onMonitor,
      maximize: false,
      fullScreen: false,
    });
  });

  it("opens in the remembered size centered on the main display when its display is gone", () => {
    remember(snapshot({ x: 1800, y: 200, width: 1000, height: 700 }));
    expect(openWindowState(file, [LAPTOP]).bounds).toEqual({
      x: 256,
      y: 135,
      width: 1000,
      height: 700,
    });
  });

  it("shrinks a window larger than its display to the work area", () => {
    remember(snapshot({ x: 1800, y: 200, width: 2400, height: 1300 }));
    expect(openWindowState(file, [LAPTOP]).bounds).toEqual(LAPTOP.workArea);
  });

  it("moves a window that hangs over the edge back onto its display", () => {
    remember(snapshot({ x: 1000, y: 600, width: 1000, height: 700 }));
    expect(openWindowState(file, [LAPTOP]).bounds).toEqual({
      x: 512,
      y: 245,
      width: 1000,
      height: 700,
    });
  });

  it("never opens narrower than the minimum width", () => {
    remember(snapshot({ x: 100, y: 100, width: 300, height: 500 }));
    expect(openWindowState(file, BOTH).bounds.width).toBe(MINIMUM_WIDTH);
  });

  it("opens maximized when the window was maximized", () => {
    remember(snapshot({ x: 100, y: 100, width: 900, height: 600 }, { maximized: true }));
    expect(openWindowState(file, BOTH)).toMatchObject({ maximize: true, fullScreen: false });
  });

  it("opens in full screen when the window was in full screen", () => {
    remember(snapshot({ x: 100, y: 100, width: 900, height: 600 }, { fullScreen: true }));
    expect(openWindowState(file, BOTH)).toMatchObject({ maximize: false, fullScreen: true });
  });
});

describe("recordWindowState", () => {
  const first = { x: 100, y: 100, width: 900, height: 600 };
  const last = { x: 300, y: 150, width: 1000, height: 650 };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("writes once, half a second after the last change of a burst", () => {
    const recorder = recordWindowState(file, globalThis);
    recorder.change(snapshot(first));
    vi.advanceTimersByTime(WRITE_DELAY_MS - 1);
    recorder.change(snapshot(last));
    vi.advanceTimersByTime(WRITE_DELAY_MS - 1);
    expect(readdirSync(folder)).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(openWindowState(file, BOTH).bounds).toEqual(last);
  });

  it("writes at once when the window closes", () => {
    const recorder = recordWindowState(file, globalThis);
    recorder.change(snapshot(first));
    recorder.close(snapshot(last));
    expect(openWindowState(file, BOTH).bounds).toEqual(last);

    // The pending write of the burst does not overwrite the state from closing.
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(openWindowState(file, BOTH).bounds).toEqual(last);
  });

  it("leaves no temporary file behind", () => {
    const recorder = recordWindowState(file, globalThis);
    recorder.change(snapshot(first));
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    recorder.close(snapshot(last));
    expect(readdirSync(folder)).toEqual(["window-state.json"]);
  });

  it("records the normal bounds the window reports after it is maximized or in full screen", () => {
    const recorder = recordWindowState(file, globalThis);
    recorder.change(snapshot(first));
    // The macOS zoom animation reports its frames before the window counts as maximized; the
    // window still keeps the bounds from before as its normal bounds.
    recorder.change(snapshot({ x: 60, y: 70, width: 1200, height: 800 }));
    recorder.change(snapshot({ x: 10, y: 35, width: 1500, height: 943 }));
    recorder.change(snapshot(first, { maximized: true }));
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(openWindowState(file, BOTH)).toEqual({
      bounds: first,
      maximize: true,
      fullScreen: false,
    });

    recorder.close(snapshot(first, { fullScreen: true }));
    expect(openWindowState(file, BOTH)).toEqual({
      bounds: first,
      maximize: false,
      fullScreen: true,
    });
  });

  it("logs a failed write instead of throwing", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const recorder = recordWindowState(join(folder, "missing", "window-state.json"), globalThis);
    expect(() => recorder.close(snapshot(first))).not.toThrow();
    expect(logged).toHaveBeenCalledOnce();
  });
});
