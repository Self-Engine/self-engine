// The texts of Reasons (D334): each written by the package that owns the Reason, with its details
// typed, and composed where the app is put together. Here the frame's two Reasons of the reference
// check, over the table names of the `notes` test module.

import type { Reason, ReasonDefinition, referenced } from "@self-engine/data-protocol";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { notesTableNames } from "@self-engine/storage/testing/table-names";
import { expect, test } from "vite-plus/test";
import {
  type FrameReasons,
  frameReasonTexts,
  type ReasonText,
  refusalTexts,
} from "./reason-texts.ts";

const texts = refusalTexts<FrameReasons>(frameReasonTexts, (table) =>
  table === "notes" ? notesTableNames.notes : undefined,
);

function referencedBy(tables: readonly { table: string; count: number }[]): Reason {
  return {
    code: "referenced",
    severity: "blocking",
    table: "notes",
    row: "n-1",
    details: { tables },
  };
}

const TARGET_DELETED: Reason = {
  code: "target_deleted",
  severity: "blocking",
  table: "note_links",
  row: "l-1",
  field: "note_id",
  details: { target: { table: "notes", id: "n-1" } },
};

test("a refused delete names each referring table with its count, in English and German", async () => {
  const i18n = createI18n();
  const one = referencedBy([{ table: "notes", count: 1 }]);
  const several = referencedBy([
    { table: "notes", count: 12 },
    { table: "note_links", count: 3 },
  ]);

  await activateLanguage(i18n, "en");
  expect(texts.describe(one, i18n)).toBe("Cannot be deleted: 1 note refers to it.");
  // A table no module names reads as entries, never as its code.
  expect(texts.describe(several, i18n)).toBe(
    "Cannot be deleted: 12 notes and 3 entries refer to it.",
  );

  await activateLanguage(i18n, "de");
  expect(texts.describe(one, i18n)).toBe("Lässt sich nicht löschen: 1 Notiz verweist darauf.");
  expect(texts.describe(several, i18n)).toBe(
    "Lässt sich nicht löschen: 12 Notizen und 3 Einträge verweisen darauf.",
  );
});

test("a reference to a deleted entry names that entry's table", async () => {
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe(TARGET_DELETED, i18n)).toBe("The linked note was deleted.");
  await activateLanguage(i18n, "de");
  expect(texts.describe(TARGET_DELETED, i18n)).toBe(
    "Der verknüpfte Eintrag (Notiz) wurde gelöscht.",
  );
});

test("a Reason without a text reads as a general refusal, never as its code", async () => {
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  const unknown: Reason = { ...TARGET_DELETED, code: "billed", details: {} };
  expect(texts.describe(unknown, i18n)).toBe("This change is not allowed.");
});

test("a text reads its Reason's details typed, and the composition demands every text", () => {
  // Compile-time checks: the type check of `pnpm verify` fails if any expectation breaks.
  const tables: ReasonText<typeof referenced> = (reason) =>
    reason.details.tables.map(({ table, count }) => `${String(count)} ${table}`).join();
  // @ts-expect-error The details of `referenced` have no `tabels`.
  const misspelled: ReasonText<typeof referenced> = (r) => r.details.tabels;
  // @ts-expect-error The text of `target_deleted` is missing.
  refusalTexts<FrameReasons>({ referenced: frameReasonTexts.referenced }, () => undefined);
  type Billed = ReasonDefinition<"billed">;
  // @ts-expect-error A Reason defined above the frame needs its own text.
  refusalTexts<FrameReasons | Billed>(frameReasonTexts, () => undefined);
  // @ts-expect-error The list of Reasons is named, not inferred from the texts given.
  refusalTexts(frameReasonTexts, () => undefined);
  expect([tables, misspelled].every((text) => typeof text === "function")).toBe(true);
});
