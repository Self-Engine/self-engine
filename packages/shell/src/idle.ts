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

/** False until the first idle moment after the first paint, then true for good. */
export function useAfterFirstIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => (idle ? undefined : whenIdle(() => setIdle(true))), [idle]);
  return idle;
}
