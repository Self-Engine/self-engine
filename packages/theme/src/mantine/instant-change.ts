import { useLayoutEffect } from "react";

const NO_TRANSITIONS = "*,*::before,*::after{transition:none!important}";

function release(style: HTMLStyleElement): void {
  if (!style.isConnected) return;
  // Lets the whole document take its new values while transitions are still off. Reading a
  // layout value does that for every element, which `getComputedStyle` on one element may not.
  void document.body.offsetHeight;
  style.remove();
}

/**
 * Turns CSS transitions off whenever `changeKey` changes, so the app restyles in one step instead
 * of each element fading separately. A layout effect, because it must land before the next paint.
 * Held for two frames, because Mantine sets its color scheme attribute in a later passive effect.
 */
export function useInstantChange(changeKey: string): void {
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.textContent = NO_TRANSITIONS;
    document.head.append(style);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        release(style);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      release(style);
    };
  }, [changeKey]);
}
