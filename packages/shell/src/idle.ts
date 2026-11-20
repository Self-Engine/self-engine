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
 * Runs `work` in an idle moment after the page was drawn once more. An effect may run before the
 * first paint, and an idle callback needs no paint, so a frame is asked for first. The callback
 * of a frame runs before that frame is drawn, so the idle moment is asked for in the frame after
 * it.
 */
function whenIdleAfterAPaint(work: () => void): () => void {
  let cancel = () => cancelAnimationFrame(beforeThePaint);
  const beforeThePaint = requestAnimationFrame(() => {
    const afterThePaint = requestAnimationFrame(() => {
      cancel = whenIdle(work);
    });
    cancel = () => cancelAnimationFrame(afterThePaint);
  });
  return () => cancel();
}

/** False until the first idle moment after the first paint, then true for good. */
export function useAfterFirstIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => (idle ? undefined : whenIdleAfterAPaint(() => setIdle(true))), [idle]);
  return idle;
}
