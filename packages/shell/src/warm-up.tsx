import { Box, Kbd, Overlay, Paper, Portal } from "@mantine/core";
import { type CSSProperties, useEffect, useState } from "react";

// Present for two frames at 1 % opacity: drawn, so the GPU and the font lookup do their first-time
// work, yet not visible. Fully transparent layers are skipped by the compositor.
const HIDDEN: CSSProperties = {
  position: "fixed",
  right: 0,
  bottom: 0,
  width: 240,
  height: 80,
  opacity: 0.01,
  pointerEvents: "none",
};

const whenIdle = (work: () => void) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(work, { timeout: 2000 })
    : setTimeout(work, 1000);

/**
 * The first opening of an overlay pays for work the second one finds done: the palette's code,
 * the system font lookup for symbols such as ⌘ that the app font lacks, and the GPU's first
 * drawing of a shadow and an overlay. Paid in an idle moment after the start instead, the first
 * opening animates like every later one.
 */
export function WarmUp({ preload }: { readonly preload: readonly (() => Promise<unknown>)[] }) {
  const [phase, setPhase] = useState<"waiting" | "drawing" | "done">("waiting");
  useEffect(() => {
    whenIdle(() => {
      for (const load of preload) {
        void load().catch(() => {
          // Safe to ignore: it only costs the head start. The real opening loads again and
          // reports its own failure.
        });
      }
      setPhase("drawing");
    });
  }, [preload]);
  useEffect(() => {
    if (phase !== "drawing") return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPhase("done"));
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  if (phase !== "drawing") return null;
  return (
    <Portal>
      <Box aria-hidden style={HIDDEN}>
        <Overlay backgroundOpacity={0.35} />
        <Paper p="xs" radius="md" shadow="xl">
          <Kbd size="xs">⌘⇧⌥⌃</Kbd>
        </Paper>
      </Box>
    </Portal>
  );
}
