import { dataTexts, type ReasonDefinition } from "@self-engine/data-client/react";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { contribution as projects } from "@self-engine/projects";
import { expect, test } from "vite-plus/test";
import type { z } from "zod";
import { createModuleList } from "./module-list.ts";
import { appModules } from "./modules.ts";
import { appReasonTexts } from "./reason-texts.ts";
import { fixedClock, requireInstant } from "@self-engine/time/testing";

const clock = fixedClock(requireInstant("2026-11-20T10:00:00.000Z"));

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

/** A storage module, as far as its page needs it: no synced table, and one rule's Reason. */
type Billing = {
  readonly rowMap: Record<never, never>;
  readonly rules: readonly {
    readonly reasons: readonly ReasonDefinition<"billed", z.ZodObject<{ invoice: z.ZodString }>>[];
  }[];
};

test("the texts a mounted module's data texts bring describe its Reasons", async () => {
  const billing = {
    id: "billing",
    name: projects.name,
    icon: projects.icon,
    color: projects.color,
    views: projects.views,
    dataTexts: dataTexts<Billing>()({
      tableNames: {},
      reasonTexts: { billed: ({ details }) => `Billed on ${details.invoice}.` },
    }),
  };
  const texts = appReasonTexts(createModuleList([projects, billing], clock));
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe({ ...referenced, code: "billed", details: { invoice: "R-7" } }, i18n)).toBe(
    "Billed on R-7.",
  );
});
