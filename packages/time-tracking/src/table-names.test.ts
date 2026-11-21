// The module names its table for the texts of a Refusal (D335): a project with time entries reads
// "Cannot be deleted: 2 time entries refer to it." in English and German.

import { type Reason, refusalTexts } from "@self-engine/data-client/react";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { expect, test } from "vite-plus/test";
import { timeTrackingTableNames } from "./table-names.ts";

const texts = refusalTexts([], (table) =>
  table === "time_entries" ? timeTrackingTableNames.time_entries : undefined,
);

const referencedBy = (count: number): Reason => ({
  code: "referenced",
  severity: "blocking",
  table: "projects",
  row: "p-1",
  details: { tables: [{ table: "time_entries", count }] },
});

test("a refused delete of a project names its time entries with their count", async () => {
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe(referencedBy(1), i18n)).toBe(
    "Cannot be deleted: 1 time entry refers to it.",
  );
  expect(texts.describe(referencedBy(12), i18n)).toBe(
    "Cannot be deleted: 12 time entries refer to it.",
  );

  await activateLanguage(i18n, "de");
  expect(texts.describe(referencedBy(1), i18n)).toBe(
    "Lässt sich nicht löschen: 1 Zeiteintrag verweist darauf.",
  );
  expect(texts.describe(referencedBy(12), i18n)).toBe(
    "Lässt sich nicht löschen: 12 Zeiteinträge verweisen darauf.",
  );
});
