import { LANGUAGE_TAGS } from "@self-engine/i18n";
import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { ACCENT_IDS, BUILT_IN_THEMES } from "@self-engine/theme";
import { resolveTimeZone } from "@self-engine/time";
import { requireInstant } from "@self-engine/time/testing";
import { expect, test } from "vite-plus/test";
import { auditSettingsRows } from "./audit-rows.ts";
import { auditSettingsArea } from "./audit.ts";
import { backupSize, backupTime } from "./backup-rows.tsx";
import { createSettingsArea } from "./index.ts";
import { settingsRows } from "./rows.tsx";
import { searchedRows, searchHits } from "./search.ts";
import type { Translator } from "./text.ts";
import { accentRow } from "./theme-rows.tsx";
import { type VersionInfo, versionLine } from "./version.ts";

const DESKTOP: VersionInfo = {
  version: "0.4.0-nightly.20261112.3",
  channel: "nightly",
  operatingSystem: "macOS",
};
const WEB: VersionInfo = { version: "0.4.0", operatingSystem: "Windows" };

const views = [{ id: "appearance" }, { id: "language" }];
const row = (id: string, view: string, settings: readonly string[] = []) => ({
  id,
  view,
  settings,
});

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

const newStore = () =>
  createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: () => {},
  });

const inputs = () => ({ store: newStore(), version: () => WEB, commandOwners: () => [] });

test("a Setting that has to be served and that no row serves is reported", () => {
  const rows = [
    row("color-mode", "appearance", ["appearance.colorMode"]),
    row("version", "language"),
  ];
  expect(auditSettingsRows(rows, views, ["appearance.colorMode", "i18n.language"])).toEqual([
    "Setting i18n.language is served by no Settings Row",
  ]);
});

test.each([
  ["in the desktop app", DESKTOP],
  ["on the web", WEB],
])("the real list of Settings Rows fits the Views of the settings area %s", (_where, version) => {
  const area = createSettingsArea({ ...inputs(), version: () => version });
  expect(auditSettingsArea(area.views, { version, commandOwners: [] })).toEqual([]);
});

test("the audit of the area reports a Setting the area has to show and that no View can serve", () => {
  expect(auditSettingsArea([{ id: "about" }], { version: WEB, commandOwners: [] })).toEqual(
    expect.arrayContaining([
      "Settings Row color-mode belongs to the unknown View appearance",
      "Settings Row app-language belongs to the unknown View language",
    ]),
  );
});

test("the settings area is the contribution `settings` and opens on Appearance", () => {
  const area = createSettingsArea(inputs());
  expect(area.id).toBe("settings");
  expect(area.views[0].id).toBe("appearance");
});

test("the settings area has the Views Appearance, Language, Shortcuts, Data and About", () => {
  expect(createSettingsArea(inputs()).views.map((view) => view.id)).toEqual([
    "appearance",
    "language",
    "shortcuts",
    "data",
    "about",
  ]);
});

test("the View Data arrived with its rows: take a Backup, and restore one", () => {
  expect(
    settingsRows({ version: WEB, commandOwners: [] })
      .filter((row) => row.view === "data")
      .map((row) => row.id),
  ).toEqual(["create-backup", "restore-backup"]);
});

const aboutRowIds = (version: VersionInfo) =>
  settingsRows({ version, commandOwners: [] })
    .filter((row) => row.view === "about")
    .map((row) => row.id);

test("About has a row for the channel in the desktop app", () => {
  expect(aboutRowIds(DESKTOP)).toContain("channel");
});

test("About has no row for the channel on the web", () => {
  expect(aboutRowIds(WEB)).not.toContain("channel");
  expect(aboutRowIds(WEB)).toEqual(expect.arrayContaining(["version", "operating-system"]));
});

test("the line for a bug report names version, channel and operating system", () => {
  expect(versionLine(DESKTOP)).toBe("Self-Engine 0.4.0-nightly.20261112.3 (nightly), macOS");
});

test("the line for a bug report from the web leaves the channel out", () => {
  expect(versionLine(WEB)).toBe("Self-Engine 0.4.0, Windows");
});

test("the line for a bug report says so when the app does not know its version", () => {
  expect(versionLine({ channel: "nightly", operatingSystem: "macOS" })).toBe(
    "Self-Engine unknown version (nightly), macOS",
  );
});

test("About keeps its row for the version when the app does not know it", () => {
  expect(aboutRowIds({ channel: "nightly", operatingSystem: "macOS" })).toEqual([
    "version",
    "channel",
    "operating-system",
    "copy-version-information",
    "license",
  ]);
});

test('every Accent a user may pick has a name, and so does "From Theme"', () => {
  expect(accentRow(BUILT_IN_THEMES).values).toHaveLength(ACCENT_IDS.length + 1);
});

const foundBy = (search: string, i18n: Translator) =>
  searchHits(
    searchedRows(settingsRows({ version: WEB, commandOwners: [] }), i18n),
    search,
  )?.flatMap((group) => group.rows.map((found) => found.id));

test.each([
  ["macOS", "operating-system", DESKTOP],
  ["Windows", "operating-system", WEB],
  ["AGPL-3.0-only", "license", DESKTOP],
  ["0.4.0-nightly.20261112.3", "version", DESKTOP],
  ["0.4.0", "version", WEB],
  ["Unknown", "version", { operatingSystem: "macOS" }],
])("About's shown value %s finds its row", (query, id, version) => {
  const english: Translator = { locale: "en", _: (descriptor) => descriptor.message ?? "" };
  const rows = settingsRows({ version, commandOwners: [] });
  expect(
    searchHits(searchedRows(rows, english), query)?.flatMap((group) =>
      group.rows.map((found) => found.id),
    ),
  ).toEqual([id]);
});

test("About's unknown version is found in the language shown", () => {
  const german: Translator = {
    locale: "de",
    _: (descriptor) =>
      descriptor.message === "Unknown" ? "Unbekannt" : (descriptor.message ?? ""),
  };
  const rows = settingsRows({ version: { operatingSystem: "macOS" }, commandOwners: [] });
  expect(
    searchHits(searchedRows(rows, german), "Unbekannt")?.flatMap((group) =>
      group.rows.map((found) => found.id),
    ),
  ).toEqual(["version"]);
  expect(searchHits(searchedRows(rows, german), "Unknown")).toEqual([]);
});

test.each(LANGUAGE_TAGS)(
  "the App Language is found by the name of %s in the language shown",
  (tag) => {
    const english: Translator = { locale: "en", _: (descriptor) => descriptor.message ?? "" };
    const german: Translator = { ...english, locale: "de" };
    const name = (locale: string) => new Intl.DisplayNames([locale], { type: "language" }).of(tag)!;
    expect(foundBy(name("en"), english)).toEqual(["app-language"]);
    expect(foundBy(name("de"), german)).toEqual(["app-language"]);
  },
);

test("the App Language is found as German in English and as Englisch in German", () => {
  const english: Translator = { locale: "en", _: (descriptor) => descriptor.message ?? "" };
  expect(foundBy("german", english)).toEqual(["app-language"]);
  expect(foundBy("englisch", { ...english, locale: "de" })).toEqual(["app-language"]);
});

test.each([
  ["backup", ["create-backup", "restore-backup"]],
  ["safety copy", ["create-backup"]],
  ["recover", ["restore-backup"]],
  // The reason a Backup was taken is a value its row shows.
  ["daily backup", ["restore-backup"]],
])("the rows of the View Data are found by %s", (query, ids) => {
  const english: Translator = { locale: "en", _: (descriptor) => descriptor.message ?? "" };
  expect(foundBy(query, english)).toEqual(ids);
});

const ENGLISH_NUMBERS = {
  number: (value: number, format?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat("en", format).format(value),
};

test.each([
  [812_000, "812 kB"],
  [4096, "4.1 kB"],
  [2_150_400, "2.2 MB"],
  [48_300_000, "48 MB"],
  [3_200_000_000, "3.2 GB"],
])("a Backup of %i bytes is shown as %s", (bytes, shown) => {
  expect(backupSize(bytes, ENGLISH_NUMBERS)).toBe(shown);
});

test("a Backup's time is written in the language shown and the zone given", () => {
  const backup = { takenAt: requireInstant("2026-11-13T23:30:00.000Z") };
  const berlin = resolveTimeZone("Europe/Berlin").timeZone;
  const bangkok = resolveTimeZone("Asia/Bangkok").timeZone;

  expect(backupTime(backup, { locale: "en", _: () => "" }, berlin)).toBe("Nov 14, 2026, 12:30 AM");
  expect(backupTime(backup, { locale: "de", _: () => "" }, berlin)).toBe("14.11.2026, 00:30");
  expect(backupTime(backup, { locale: "de", _: () => "" }, bangkok)).toBe("14.11.2026, 06:30");
});
