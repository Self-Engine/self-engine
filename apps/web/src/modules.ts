import { msg } from "@lingui/core/macro";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import { version } from "../package.json";
import { versionInfo } from "./env.ts";
import { settingsStore } from "./settings-store.ts";

export const modules: readonly ShellContribution[] = [beta, alpha];

const settingsArea = createSettingsArea({
  store: settingsStore,
  // The build inserts the web app's version; the desktop app's comes over the bridge.
  version: () => versionInfo(window, navigator, version),
});

/**
 * The settings area, plus two throwaway Views of the app that stay reachable until the slices
 * that replace them remove them: #160 the theme preview, #161 the language sample.
 */
export const settings: ShellContribution = {
  ...settingsArea,
  views: [
    ...settingsArea.views,
    { id: "theme-preview", title: msg`Theme preview`, load: () => import("./theme-preview.tsx") },
    {
      id: "language-sample",
      title: msg`Language sample`,
      load: () => import("./language-sample.tsx"),
    },
  ],
};

export const contributions = [...modules, settings];
validateContributions(contributions);

export function findModule(id: string): ShellContribution | undefined {
  return contributions.find((module) => module.id === id);
}
export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}
