import type { AnyReasonText, DataTexts } from "@self-engine/data-client/react";
import type { CountedName } from "@self-engine/i18n";
import { createSettingsArea } from "@self-engine/settings-area";
import { type ShellContribution, validateContributions } from "@self-engine/shell";
import type { Clock } from "@self-engine/time";
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
  /** The plural message for a mounted synced table, keyed by its SQL name. */
  readonly tableName: (table: string) => CountedName | undefined;
  /** The texts of the Reasons the mounted modules' rules answer with, one set per module. */
  readonly reasonTexts: readonly Readonly<Record<string, AnyReasonText>>[];
}

/** A module the list mounts: its data texts are checked against its storage module. */
type MountedContribution = ShellContribution & { readonly dataTexts: DataTexts };

/** What every route reads from the router's context: the modules it mounts. */
export interface AppRouterContext {
  readonly moduleList: ModuleList;
}

export function defaultAddress(module: ShellContribution) {
  return `/${module.id}/${module.views[0].id}`;
}

/**
 * Throws when two contributions claim an address or a synced table. `clock` is the page's Clock,
 * the one its `PageClockProvider` gets.
 */
export function createModuleList(
  modules: readonly [MountedContribution, ...MountedContribution[]],
  clock: Clock,
): ModuleList {
  const settings = createSettingsArea({
    store: settingsStore,
    // The build inserts the web app's version; the desktop app's comes over the bridge.
    version: () => versionInfo(window, navigator, version),
    // Every contribution, so that a new module's Shortcuts are listed by themselves.
    commandOwners: () => contributions,
    clock,
  });
  const contributions = [...modules, settings];
  validateContributions(contributions);
  const tableNames = new Map<string, CountedName>();
  for (const module of modules) {
    for (const [table, name] of Object.entries(module.dataTexts.tableNames)) {
      if (tableNames.has(table)) throw new Error(`Duplicate synced table name: ${table}`);
      tableNames.set(table, name);
    }
  }
  return {
    modules,
    settings,
    contributions,
    startAddress: defaultAddress(modules[0]),
    find: (id) => contributions.find((module) => module.id === id),
    tableName: (table) => tableNames.get(table),
    reasonTexts: modules.map((module) => module.dataTexts.reasonTexts),
  };
}
