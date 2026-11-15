import type { Plugin } from "vite-plus";

/** The environment variable that switches the dev server to the stories' module list. */
export const STORY_MODULES_ENV = "SELF_ENGINE_STORY_MODULES";

const APP_LIST = /\/apps\/web\/src\/modules\.ts$/;

/**
 * Serves the app with the stories' module list in place of its own, so that a measurement of the
 * real app in the dev server (`pnpm renders`) can still open the placeholder modules, which left
 * the app (D315). Only the dev server applies it, and only when `enabled`: a build never does.
 */
export function storyModuleList(enabled: boolean): Plugin {
  return {
    name: "self-engine:story-module-list",
    apply: () => false,
    ...(enabled && {
      apply: "serve",
      load(id) {
        if (!APP_LIST.test(id.split("?")[0] ?? id)) return undefined;
        return 'export { storyModules as appModules } from "./story-modules.ts";\n';
      },
    }),
  };
}
