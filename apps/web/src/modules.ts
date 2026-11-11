import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import { version } from "../package.json";
import { versionInfo } from "./env.ts";
import { settingsStore } from "./settings-store.ts";

export const modules: readonly ShellContribution[] = [beta, alpha];

/** The settings area, which the Shell gets beside the modules. */
export const settings: ShellContribution = createSettingsArea({
  store: settingsStore,
  // The build inserts the web app's version; the desktop app's comes over the bridge.
  version: () => versionInfo(window, navigator, version),
});

export const contributions = [...modules, settings];
validateContributions(contributions);

export function findModule(id: string): ShellContribution | undefined {
  return contributions.find((module) => module.id === id);
}
export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}
