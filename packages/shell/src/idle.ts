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
 * Runs `work` in an idle moment two frames from now. An effect may run before the first paint, and
 * an idle callback needs no paint. The callback of a frame runs before that frame is drawn, so the
 * second callback comes after the browser had its chance to draw the first. A chance, not a
 * promise: nothing here observes a paint. In the desktop app the two callbacks came about a
 * millisecond apart and the work began before the first paint was reported
 * (docs/development/performance.md, "Module Indicator startup").
 */
function whenIdleAfterTwoFrames(work: () => void): () => void {
  let cancel = () => cancelAnimationFrame(first);
  const first = requestAnimationFrame(() => {
    const second = requestAnimationFrame(() => {
      cancel = whenIdle(work);
    });
    cancel = () => cancelAnimationFrame(second);
  });
  return () => cancel();
}

/**
 * False until an idle moment two frames after the mount, then true for good: the Shell has had its
 * chance to draw before the work that waits for this starts.
 */
export function useAfterFirstIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => (idle ? undefined : whenIdleAfterTwoFrames(() => setIdle(true))), [idle]);
  return idle;
}
