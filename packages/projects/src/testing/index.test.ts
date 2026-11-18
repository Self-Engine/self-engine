// The Fixed Answers of `projects` (D255): every listed project has a free Clearance by default,
// which a story overrides for one write without losing the others.

import { expect, test } from "vite-plus/test";
import { OLD_SHOP, projectsAnswers, WEBSITE } from "./index.ts";

const REFERENCED = {
  code: "referenced" as const,
  table: "projects",
  row: WEBSITE.id,
  details: { tables: [{ table: "project_entries", count: 2 }] },
};
const BLOCKED = { state: "blocked" as const, reasons: [REFERENCED] as [typeof REFERENCED] };

test("a project listed as active and as archived gets one Clearance, that of the active list", async () => {
  const reactivated = { ...OLD_SHOP, archivedAt: null };
  const access = projectsAnswers({ active: { data: [WEBSITE, reactivated] } });

  await expect(
    access.clearance({ table: "projects", rows: [OLD_SHOP.id], writes: ["delete", "archive"] }),
  ).resolves.toEqual([
    { row: OLD_SHOP.id, writes: { delete: { state: "free" }, archive: { state: "free" } } },
  ]);
});

test("a story's Clearance overrides one write and keeps every other default", async () => {
  const access = projectsAnswers(
    {},
    { clearance: [{ table: "projects", row: WEBSITE.id, writes: { delete: BLOCKED } }] },
  );

  await expect(
    access.clearance({ table: "projects", rows: [WEBSITE.id], writes: ["delete", "archive"] }),
  ).resolves.toEqual([
    {
      row: WEBSITE.id,
      writes: {
        delete: { state: "blocked", reasons: [{ ...REFERENCED, severity: "blocking" }] },
        archive: { state: "free" },
      },
    },
  ]);
  await expect(
    access.clearance({ table: "projects", rows: [OLD_SHOP.id], writes: ["unarchive"] }),
  ).resolves.toEqual([{ row: OLD_SHOP.id, writes: { unarchive: { state: "free" } } }]);
});
