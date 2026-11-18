import type { ReasonDefinition } from "@self-engine/data-client/react";
import { frameReasonTexts, refusalTexts } from "@self-engine/data-client/react";
import { activateLanguage, createI18n } from "@self-engine/i18n";
import { expect, test } from "vite-plus/test";
import { appModules } from "./modules.ts";
import { type AppReasons, appReasonTexts } from "./reason-texts.ts";

test("the app's composition does not compile while a Reason has no text", () => {
  // Compile-time checks: the type check of `pnpm verify` fails if any expectation breaks.
  // @ts-expect-error The text of `target_deleted` is missing.
  refusalTexts<AppReasons>({ referenced: frameReasonTexts.referenced }, appModules.tableName);
  /** A Reason a Bridge's rule would add from above, such as a billed time entry. */
  type Billed = ReasonDefinition<"billed">;
  // @ts-expect-error A new Reason in the app's list needs its owner's text.
  refusalTexts<AppReasons | Billed>(frameReasonTexts, appModules.tableName);
  expect(typeof refusalTexts).toBe("function");
});

test("the app's texts name the tables of its modules, in the App Language", async () => {
  const texts = appReasonTexts(appModules);
  const referenced = {
    code: "referenced",
    severity: "blocking",
    table: "projects",
    row: "p-1",
    details: { tables: [{ table: "projects", count: 2 }] },
  } as const;
  const i18n = createI18n();
  await activateLanguage(i18n, "en");
  expect(texts.describe(referenced, i18n)).toBe("Cannot be deleted: 2 projects refer to it.");
  await activateLanguage(i18n, "de");
  expect(texts.describe(referenced, i18n)).toBe(
    "Lässt sich nicht löschen: 2 Projekte verweisen darauf.",
  );
});
