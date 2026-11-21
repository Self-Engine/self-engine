import { useEffect, useState } from "react";

/** Runs `work` in an idle moment of the page, or after a second without idle callbacks. */
export function whenIdle(work: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const handle = requestIdleCallback(work, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(work, 1000);
  return () => clearTimeout(handle);
}

/**
 * Runs `work` two frames from now. The callback of a frame runs before that frame is drawn, so
 * the second callback comes after the browser had its chance to draw the first. A chance, not a
 * promise: in the desktop app the two callbacks came about a millisecond apart, before the first
 * paint was reported (docs/development/performance.md, "Module Indicator startup").
 */
function afterTwoFrames(work: () => void): () => void {
  let cancel = () => cancelAnimationFrame(first);
  const first = requestAnimationFrame(() => {
    const second = requestAnimationFrame(work);
    cancel = () => cancelAnimationFrame(second);
  });
  return () => cancel();
}

/** The part of the page's `PerformanceObserver` that `afterFirstPaint` uses. */
export interface PaintTiming {
  readonly supportedEntryTypes: readonly string[];
  new (callback: (list: { getEntriesByName(name: string): readonly unknown[] }) => void): {
    observe(options: { type: string; buffered: boolean }): void;
    disconnect(): void;
  };
}

/**
 * Runs `work` once the page has reported its first contentful paint, at once when that is past.
 * A page without paint timing waits two frames instead. A page that is never drawn, such as a tab
 * opened in the background, reports no paint until it is shown, so `work` waits until then.
 */
export function afterFirstPaint(
  work: () => void,
  timing: PaintTiming | undefined = globalThis.PerformanceObserver,
): () => void {
  if (timing?.supportedEntryTypes.includes("paint") !== true) return afterTwoFrames(work);
  let waiting = true;
  const observer = new timing((list) => {
    if (!waiting || list.getEntriesByName("first-contentful-paint").length === 0) return;
    waiting = false;
    observer.disconnect();
    work();
  });
  observer.observe({ type: "paint", buffered: true });
  return () => {
    waiting = false;
    observer.disconnect();
  };
}

/** Runs `work` in the first idle moment after the first paint. */
function whenIdleAfterFirstPaint(work: () => void): () => void {
  let cancel = afterFirstPaint(() => {
    cancel = whenIdle(work);
  });
  return () => cancel();
}

/**
 * False until the first idle moment after the page's first contentful paint, then true for good:
 * the Shell is on screen before the work that waits for this starts (#380).
 */
export function useAfterFirstIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => (idle ? undefined : whenIdleAfterFirstPaint(() => setIdle(true))), [idle]);
  return idle;
}
