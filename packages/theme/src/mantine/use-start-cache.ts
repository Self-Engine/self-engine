import { useEffect, useLayoutEffect } from "react";
import {
  type ColorMode,
  type ResolvedAppearance,
  START_STYLE_ID,
  writeStartCache,
} from "../core/index.ts";

/** Hands over from the inline script's first frame, and keeps the Start Cache current. */
export function useStartCache(colorMode: ColorMode, resolved: ResolvedAppearance): void {
  // The cached rule outranks Mantine's, so it has to go. Mantine's styles are in the DOM from
  // this commit on, and a layout effect runs before the browser paints it.
  useLayoutEffect(() => {
    document.getElementById(START_STYLE_ID)?.remove();
  }, []);
  useEffect(() => {
    writeStartCache(() => window.localStorage, colorMode, resolved);
  }, [colorMode, resolved]);
}
