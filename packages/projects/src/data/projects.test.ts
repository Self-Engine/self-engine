import { createMigrationRunner } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { checkContract } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import { projectIdSchema } from "../contracts/index.ts";
import { projects } from "./index.ts";
import { projectsMigrations, projectsRowMap } from "./rows.ts";

// The kit's test context hands out these ids in order: the seed's Website, its archived Tax, then
// its deleted one.
const websiteId = projectIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000");
const archivedId = projectIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000001");
const deletedId = projectIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000002");

test("the projects table follows the conventions and agrees with its row map", async () => {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, projectsMigrations).run();
    await expect(checkConventions(database)).resolves.toEqual([]);
    await expect(checkAgreement(projectsMigrations, projectsRowMap)).resolves.toEqual([]);
  } finally {
    await database.close();
  }
});

test("projects passes the storage contract kit", async () => {
  const { entries } = projects;
  await expect(
    checkContract(
      projects,
      async (tx, context) => {
        await entries.create.run(tx, context, {
          title: "Website",
          description: "Relaunch",
          icon: "house",
          color: "teal",
        });
        const tax = await entries.create.run(tx, context, { title: "Tax" });
        await entries.archive.run(tx, context, { id: tax.id });
        const removed = await entries.create.run(tx, context, { title: "Old tax" });
        await entries.delete.run(tx, context, { id: removed.id });
      },
      {
        active: {},
        archived: {},
        create: { title: "Garden", description: null, icon: "🌱", color: null },
        edit: {
          id: websiteId,
          title: "Garden",
          description: "Beds",
          icon: "🌱",
          color: "lime",
        },
        archive: { id: websiteId },
        unarchive: { id: archivedId },
        delete: { id: websiteId },
        restore: { id: deletedId },
      },
    ),
  ).resolves.toEqual([]);
});
