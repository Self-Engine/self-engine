import { createMigrationRunner } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { checkContract } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import { projects } from "./index.ts";
import { projectsMigrations, projectsRowMap } from "./rows.ts";

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
        await entries.create.run(tx, context, { title: "Tax" });
      },
      {
        active: {},
        create: { title: "Garden", description: null, icon: "🌱", color: null },
      },
    ),
  ).resolves.toEqual([]);
});
