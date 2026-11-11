import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { expect, test } from "vite-plus/test";
import { auditSettingsRows } from "./audit-rows.ts";
import { createSettingsArea } from "./index.ts";
import { SETTINGS_ROWS } from "./rows.tsx";

const views = [{ id: "appearance" }, { id: "language" }];
const row = (id: string, view: string) => ({ id, view });

test("a list in which every row has its own id and every View has a row is sound", () => {
  expect(
    auditSettingsRows([row("color-mode", "appearance"), row("language", "language")], views),
  ).toEqual([]);
});

test("a row id that is used twice is reported", () => {
  expect(
    auditSettingsRows(
      [row("density", "appearance"), row("density", "appearance"), row("language", "language")],
      views,
    ),
  ).toEqual(["Duplicate Settings Row id: density"]);
});

test("a row whose View the contribution does not have is reported", () => {
  expect(
    auditSettingsRows(
      [row("density", "appearance"), row("language", "language"), row("backup", "data")],
      views,
    ),
  ).toEqual(["Settings Row backup belongs to the unknown View data"]);
});

test("a View without a row is reported", () => {
  expect(auditSettingsRows([row("density", "appearance")], views)).toEqual([
    "View language has no Settings Row",
  ]);
});

test("the real list of Settings Rows fits the Views of the settings area", () => {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: () => {},
  });
  expect(auditSettingsRows(SETTINGS_ROWS, createSettingsArea({ store }).views)).toEqual([]);
});

test("the settings area is the contribution `settings` and opens on Appearance", () => {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: () => {},
  });
  const area = createSettingsArea({ store });
  expect(area.id).toBe("settings");
  expect(area.views[0].id).toBe("appearance");
});
