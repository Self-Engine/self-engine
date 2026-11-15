import { expect, test } from "vite-plus/test";
import { auditCommands, shellCommands, validateContributions } from "@self-engine/shell";
import { auditSettingsArea } from "@self-engine/settings-area/audit";
import { appModules } from "./modules.ts";

const { contributions, settings } = appModules;

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
