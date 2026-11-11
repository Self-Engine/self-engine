import { msg } from "@lingui/core/macro";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import { settingsStore } from "./settings-store.ts";

export const modules: readonly ShellContribution[] = [beta, alpha];

const settingsArea = createSettingsArea({ store: settingsStore });

/**
 * The settings area, plus a throwaway View of the app that stays reachable until the slice that
 * replaces it removes it: #160 the theme preview.
 */
export const settings: ShellContribution = {
  ...settingsArea,
  views: [
    ...settingsArea.views,
    { id: "theme-preview", title: msg`Theme preview`, load: () => import("./theme-preview.tsx") },
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
