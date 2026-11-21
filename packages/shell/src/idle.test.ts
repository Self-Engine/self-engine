import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { afterFirstPaint, type PaintTiming } from "./idle.ts";

interface FakeObserver {
  readonly report: (...names: string[]) => void;
  readonly observed: () => { type: string; buffered: boolean } | undefined;
  readonly disconnected: () => boolean;
}

/** A paint timing that reports what a test tells it to, and the observer it made. */
function fakePaintTiming(supported: readonly string[] = ["paint"]) {
  const made: FakeObserver[] = [];
  const timing: PaintTiming = class {
    static readonly supportedEntryTypes = supported;
    private options: { type: string; buffered: boolean } | undefined;
    private stopped = false;
    constructor(callback: (list: { getEntriesByName(name: string): readonly unknown[] }) => void) {
      made.push({
        report: (...names) =>
          callback({ getEntriesByName: (name) => names.filter((entry) => entry === name) }),
        observed: () => this.options,
        disconnected: () => this.stopped,
      });
    }
    observe(options: { type: string; buffered: boolean }) {
      this.options = options;
    }
    disconnect() {
      this.stopped = true;
    }
  };
  return { timing, made };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("afterFirstPaint", () => {
  test("waits for the first contentful paint, also one reported before it asked", () => {
    const { timing, made } = fakePaintTiming();
    const then = vi.fn();
    afterFirstPaint(then, timing);
    expect(made[0]?.observed()).toEqual({ type: "paint", buffered: true });
    expect(then).not.toHaveBeenCalled();
    made[0]?.report("first-contentful-paint");
    expect(then).toHaveBeenCalledOnce();
    expect(made[0]?.disconnected()).toBe(true);
  });

  test("a paint without content is not the Shell's", () => {
    const { timing, made } = fakePaintTiming();
    const then = vi.fn();
    afterFirstPaint(then, timing);
    made[0]?.report("first-paint");
    expect(then).not.toHaveBeenCalled();
  });

  test("runs once, however often a paint is reported", () => {
    const { timing, made } = fakePaintTiming();
    const then = vi.fn();
    afterFirstPaint(then, timing);
    made[0]?.report("first-paint", "first-contentful-paint");
    made[0]?.report("first-contentful-paint");
    expect(then).toHaveBeenCalledOnce();
  });

  test("a cancel before the paint stops the wait", () => {
    const { timing, made } = fakePaintTiming();
    const then = vi.fn();
    const cancel = afterFirstPaint(then, timing);
    cancel();
    expect(made[0]?.disconnected()).toBe(true);
    made[0]?.report("first-contentful-paint");
    expect(then).not.toHaveBeenCalled();
  });

  test("a page without paint timing waits two frames instead", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const { timing, made } = fakePaintTiming([]);
    const then = vi.fn();
    afterFirstPaint(then, timing);
    expect(made).toHaveLength(0);
    frames.shift()?.(0);
    expect(then).not.toHaveBeenCalled();
    frames.shift()?.(16);
    expect(then).toHaveBeenCalledOnce();
  });
});
