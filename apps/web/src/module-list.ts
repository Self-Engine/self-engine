import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import { version } from "../package.json";
import { versionInfo } from "./env.ts";
import { settingsStore } from "./settings-store.ts";

/**
 * The modules a router mounts, with the settings area beside them. The app has one list
 * (`modules.ts`); the stories have their own, which keeps the placeholder modules as the Shell's
 * test subjects (D315). The router hands the list to its routes through its context.
 */
export interface ModuleList {
  /** The modules in the Navbar's order. */
  readonly modules: readonly ShellContribution[];
  /** The settings area, which the Shell gets beside the modules. */
  readonly settings: ShellContribution;
  /** The modules and the settings area, every owner of a View and a Command. */
  readonly contributions: readonly ShellContribution[];
  /** The address the app starts on: the first View of the first module. */
  readonly startAddress: string;
  readonly find: (id: string) => ShellContribution | undefined;
}

/** What every route reads from the router's context: the modules it mounts. */
export interface AppRouterContext {
  readonly moduleList: ModuleList;
}

export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}

/** Throws when two contributions claim one address, so a wrong list fails at load. */
export function createModuleList(
  modules: readonly [ShellContribution, ...ShellContribution[]],
): ModuleList {
  const settings = createSettingsArea({
    store: settingsStore,
    // The build inserts the web app's version; the desktop app's comes over the bridge.
    version: () => versionInfo(window, navigator, version),
    // Every contribution, so that a new module's Shortcuts are listed by themselves.
    commandOwners: () => contributions,
  });
  const contributions = [...modules, settings];
  validateContributions(contributions);
  return {
    modules,
    settings,
    contributions,
    startAddress: defaultAddress(modules[0]),
    find: (id) => contributions.find((module) => module.id === id),
  };
}
