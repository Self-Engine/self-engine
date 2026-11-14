import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { contribution as projects } from "@self-engine/projects";
import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import { version } from "../package.json";
import { versionInfo } from "./env.ts";
import { settingsStore } from "./settings-store.ts";

// The placeholders leave with #306, and `projects` becomes the start address then.
export const modules: readonly ShellContribution[] = [beta, alpha, projects];

/** The settings area, which the Shell gets beside the modules. */
export const settings: ShellContribution = createSettingsArea({
  store: settingsStore,
  // The build inserts the web app's version; the desktop app's comes over the bridge.
  version: () => versionInfo(window, navigator, version),
  // Every contribution, so that a new module's Shortcuts are listed by themselves.
  commandOwners: () => contributions,
});

export const contributions = [...modules, settings];
validateContributions(contributions);

export function findModule(id: string): ShellContribution | undefined {
  return contributions.find((module) => module.id === id);
}
export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}
