// The Start Cache: a copy of the last engine output, for the inline script in the app's HTML
// that paints the first frame before React starts. Never the source of truth.

import { cssDeclarations } from "./css.ts";
import type { ColorMode, ColorModeValues, ResolvedAppearance } from "./resolve.ts";
import { COLOR_MODES, type ResolvedColorMode } from "./roles.ts";

/** The storage key. The inline script in `apps/web/index.html` repeats it. */
export const START_CACHE_KEY = "self-engine:start-cache";

/** The id of the `<style>` the inline script adds. The provider removes it once it has rendered. */
export const START_STYLE_ID = "se-start-cache";

/** Mantine's own variables sit on `:root[data-mantine-color-scheme="…"]`; this must outrank it. */
const START_SELECTOR = "html:root[data-mantine-color-scheme]";

/** Ready-made CSS, so that the inline script stays free of any knowledge about Themes. */
interface StartCache {
  readonly version: 1;
  readonly colorMode: ColorMode;
  readonly density: string;
  readonly css: Readonly<Record<ResolvedColorMode, string>>;
}

function colorModeCss(mode: ResolvedColorMode, values: ColorModeValues): string {
  const variables = cssDeclarations({ ...values.cssVariables, ...values.mantineVariables });
  const { canvas, text } = values.roles;
  return `${START_SELECTOR}{color-scheme:${mode};background:${canvas};color:${text};${variables}}`;
}

/** The text to store under `START_CACHE_KEY` for the current output. */
export function serializeStartCache(colorMode: ColorMode, resolved: ResolvedAppearance): string {
  const [light, dark] = COLOR_MODES.map((mode) => colorModeCss(mode, resolved[mode])) as [
    string,
    string,
  ];
  const cache: StartCache = {
    version: 1,
    colorMode,
    density: resolved.layout.density,
    css: { light, dark },
  };
  return JSON.stringify(cache);
}

/** Copies the current output to the storage. Reaching the storage can throw too, hence `get`. */
export function writeStartCache(
  getStorage: () => { setItem(key: string, value: string): unknown },
  colorMode: ColorMode,
  resolved: ResolvedAppearance,
): void {
  try {
    getStorage().setItem(START_CACHE_KEY, serializeStartCache(colorMode, resolved));
  } catch {
    // Only a copy: without it the next start uses the neutral default.
  }
}
