import { expect, test } from "vite-plus/test";
import { activateLanguage, createI18n, formatCountedList } from "@self-engine/i18n";
import { auditSettingsArea } from "@self-engine/settings-area/audit";
import {
  auditCommands,
  type ShellContribution,
  shellCommands,
  validateContributions,
} from "@self-engine/shell";
import { createModuleList } from "./module-list.ts";
import { appModules } from "./modules.ts";

const { contributions, settings } = appModules;

function mountWithoutNames(module: ShellContribution) {
  // @ts-expect-error Mounting requires an explicit table name map.
  createModuleList([module]);
}
void mountWithoutNames;

test("the app mounts projects and no placeholder module (D315)", () => {
  expect(appModules.modules.map((module) => module.id)).toEqual(["projects"]);
  expect(contributions.map((module) => module.id)).toEqual(["projects", "settings"]);
});

test('the app starts on the View "Active" of projects', () => {
  expect(appModules.startAddress).toBe("/projects/active");
});

test("a module is found by its id, the settings area too, and an uninstalled one is not", () => {
  expect(appModules.find("projects")?.id).toBe("projects");
  expect(appModules.find("settings")).toBe(settings);
  expect(appModules.find("placeholder-alpha")).toBeUndefined();
});

test("the app can look up a synced table's singular and plural names in both languages", async () => {
  const name = appModules.tableName("projects");
  if (!name) throw new Error("The projects table has no name");
  const i18n = createI18n();

  await activateLanguage(i18n, "en");
  expect(i18n._(name(1))).toBe("project");
  expect(i18n._(name(2))).toBe("projects");

  await activateLanguage(i18n, "de");
  expect(i18n._(name(1))).toBe("Projekt");
  expect(i18n._(name(2))).toBe("Projekte");
  expect(appModules.tableName("placeholder_alpha_entries")).toBeUndefined();
  expect(appModules.tableName("toString")).toBeUndefined();
});

test("a list of table counts follows the App Language, including its conjunction and plurals", async () => {
  const { storyModules } = await import("./story-modules.ts");
  const entry = storyModules.tableName("placeholder_alpha_entries");
  const project = storyModules.tableName("projects");
  if (!entry || !project) throw new Error("The story modules must name their tables");
  const counted = [
    { name: entry, count: 1200 },
    { name: project, count: 1 },
    { name: project, count: 2 },
  ];
  const i18n = createI18n();

  await activateLanguage(i18n, "en");
  expect(formatCountedList(i18n, counted)).toBe("1,200 entries, 1 project and 2 projects");

  await activateLanguage(i18n, "de");
  expect(formatCountedList(i18n, counted)).toBe("1.200 Einträge, 1 Projekt und 2 Projekte");
});

test("two mounted modules cannot claim the same synced table", async () => {
  const { contribution: alpha } = await import("@self-engine/placeholder-alpha");
  const { contribution: beta } = await import("@self-engine/placeholder-beta");
  expect(() => createModuleList([alpha, { ...beta, tableNames: alpha.tableNames }])).toThrow(
    "Duplicate synced table name: placeholder_alpha_entries",
  );
});

// The Command Palette and the View Shortcuts list the Commands of these contributions.
test("the app's Commands are those of projects and the settings area, none of a placeholder", () => {
  const owners = new Set(
    contributions.flatMap((module) => (module.commands ?? []).map(() => module.id)),
  );
  expect(owners.has("projects")).toBe(true);
  expect([...owners].filter((id) => id.startsWith("placeholder-"))).toEqual([]);
});

test("every installed module and Settings has valid, unambiguous addresses", () => {
  expect(() => validateContributions(contributions)).not.toThrow();
});

test("every Command has a unique full id and a schema that matches its kind", async () => {
  await expect(auditCommands([...contributions, shellCommands])).resolves.toEqual([]);
});

// The rows of the View Shortcuts are produced from these contributions, so only here is the list
// the one the app shows (ADR 0016).
test.each([
  ["in the desktop app", { version: "0.4.0", channel: "nightly", operatingSystem: "macOS" }],
  ["on the web", { version: "0.4.0", operatingSystem: "Windows" }],
] as const)(
  "the app's real list of Settings Rows fits the Views of Settings %s",
  (_where, version) => {
    expect(auditSettingsArea(settings.views, { version, commandOwners: contributions })).toEqual(
      [],
    );
  },
);

test("the stories mount the placeholders beside every module of the app, under their own list", async () => {
  const { storyModules } = await import("./story-modules.ts");
  const ids = storyModules.modules.map((module) => module.id);
  expect(ids).toEqual(expect.arrayContaining(["placeholder-alpha", "placeholder-beta"]));
  expect(ids).toEqual(expect.arrayContaining(appModules.modules.map((module) => module.id)));
  expect(storyModules).not.toBe(appModules);
});
