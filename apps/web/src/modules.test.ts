import { expect, test } from "vite-plus/test";
import { auditCommands, shellCommands, validateContributions } from "@self-engine/shell";
import { auditSettingsArea } from "@self-engine/settings-area/audit";
import { contributions, settings } from "./modules.ts";

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
] as const)("the app's real list of Settings Rows fits the Views of Settings %s", (_where, version) => {
  expect(auditSettingsArea(settings.views, { version, commandOwners: contributions })).toEqual([]);
});
