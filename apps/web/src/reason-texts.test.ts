import { activateLanguage, createI18n } from "@self-engine/i18n";
import { expect, test } from "vite-plus/test";
import { appModules } from "./modules.ts";
import { appReasonTexts } from "./reason-texts.ts";

const referenced = {
  code: "referenced",
  severity: "blocking",
  table: "projects",
  row: "p-1",
  details: { tables: [{ table: "projects", count: 2 }] },
} as const;

test("the app's texts name the tables of its modules, in the App Language", async () => {
  const texts = appReasonTexts(appModules);
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe(referenced, i18n)).toBe("Cannot be deleted: 2 projects refer to it.");
  await activateLanguage(i18n, "de");
  expect(texts.describe(referenced, i18n)).toBe(
    "Lässt sich nicht löschen: 2 Projekte verweisen darauf.",
  );
});

test("the texts a mounted module's data texts bring describe its Reasons", async () => {
  const billed = { pinned: () => "Billed time is not deleted." };
  const texts = appReasonTexts({ ...appModules, reasonTexts: [billed] });
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe({ ...referenced, code: "pinned", details: {} }, i18n)).toBe(
    "Billed time is not deleted.",
  );
});
