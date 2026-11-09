import { useLayoutEffect } from "react";

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

/**
 * Lets the CSS hide the focus ring after the pointer, because `:focus-visible` alone does not: it
 * stays lit when a control with the keyboard's focus is clicked, and it passes on when a script
 * moves the focus, as the Drawer's focus trap and focus return do. A modifier alone is no keyboard
 * use, since it starts every shortcut that leaves the window.
 */
export function useLastInput(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const onPointerDown = () => {
      root.dataset.lastInput = "pointer";
    };
    const onKeyDown = ({ key }: KeyboardEvent) => {
      if (!MODIFIER_KEYS.has(key)) delete root.dataset.lastInput;
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      delete root.dataset.lastInput;
    };
  }, []);
}
