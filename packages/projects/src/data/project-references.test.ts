import { createRouterClient } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { createSpaceRows, SECOND_SPACE_ID } from "@self-engine/spaces/testing";
import { createContext, createFrame, sharedWrites } from "@self-engine/storage";
import { checkContract, createTestContext, createTestDatabase } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import { projectEntryIdSchema } from "../../test/project-entries-module/contracts/index.ts";
import { projectEntries } from "../../test/project-entries-module/data/index.ts";
import { projectIdSchema, projectReferenceSchema } from "../contracts/index.ts";
import { projectReferences, projects } from "./index.ts";
import type { projectsRowMap } from "./rows.ts";

type ProjectsTables = TablesOf<typeof projectsRowMap>;

/** `projects` and the test module above it over one database, with the deleted mark's Instant. */
async function setUp() {
  const database = await createTestDatabase(projectEntries, [projects]);
  const sources = createTestContext();
  const projectsClient = createRouterClient(
    createFrame(projects, { database, sources, checkOutputs: true }),
  );
  const client = createRouterClient(
    createFrame(projectEntries, { database, sources, checkOutputs: true }),
  );
  /** Runs a write of `projects` that its Port does not offer yet, such as archive and delete. */
  const write = (
    change: (
      writes: ReturnType<typeof sharedWrites<ProjectsTables>>,
      id: ReturnType<typeof projectIdSchema.parse>,
    ) => Promise<unknown>,
    id: string,
    spaceId = createContext(sources).spaceId,
  ) =>
    database.kysely
      .transaction()
      .execute((tx) =>
        change(
          sharedWrites(tx.withTables<ProjectsTables>(), { ...createContext(sources), spaceId }),
          projectIdSchema.parse(id),
        ),
      );
  return { database, sources, projectsClient, client, write };
}

const NOW = "2026-11-12T12:00:00.000Z";

test("the Read Piece gives the six fields of an active, an archived and a deleted project in one Query", async () => {
  const { database, projectsClient, client, write } = await setUp();
  try {
    const website = await projectsClient.create({ title: "Website", icon: "house", color: "teal" });
    const archive = await projectsClient.create({ title: "Archive", icon: "🌱" });
    const deleted = await projectsClient.create({ title: "Deleted" });
    for (const project of [website, archive, deleted])
      await client.create({ projectId: project.id, label: `On ${project.title}` });
    await write((writes, id) => writes.archive("projects", id), archive.id);
    await write((writes, id) => writes.softDelete("projects", id), deleted.id);

    expect((await client.list({})).map((entry) => entry.project)).toEqual([
      {
        id: archive.id,
        title: "Archive",
        icon: "🌱",
        color: null,
        archivedAt: NOW,
        deletedAt: null,
      },
      {
        id: deleted.id,
        title: "Deleted",
        icon: null,
        color: null,
        archivedAt: null,
        deletedAt: NOW,
      },
      {
        id: website.id,
        title: "Website",
        icon: "house",
        color: "teal",
        archivedAt: null,
        deletedAt: null,
      },
    ]);
  } finally {
    await database.close();
  }
});

test("the Read Piece gives nothing of a project in another Space", async () => {
  const { database, projectsClient, client } = await setUp();
  try {
    await createSpaceRows(database.kysely, [{ id: SECOND_SPACE_ID }]);
    const moved = await projectsClient.create({ title: "Private" });
    const entry = await client.create({ projectId: moved.id, label: "Recorded work" });
    await database.kysely
      .withTables<{ projects: { id: string; space_id: string } }>()
      .updateTable("projects")
      .set({ space_id: SECOND_SPACE_ID })
      .where("id", "=", moved.id)
      .execute();
    expect(await client.list({})).toEqual([{ ...entry, project: null }]);
  } finally {
    await database.close();
  }
});

test("the released schema accepts exactly what the Read Piece gives", async () => {
  const { database, sources, projectsClient, write } = await setUp();
  try {
    await projectsClient.create({ title: "Active", icon: "house", color: "teal" });
    const archived = await projectsClient.create({ title: "Archived" });
    const deleted = await projectsClient.create({ title: "Deleted" });
    await write((writes, id) => writes.archive("projects", id), archived.id);
    await write((writes, id) => writes.softDelete("projects", id), deleted.id);
    const rows = await database.kysely.transaction().execute((tx) =>
      tx
        .selectFrom(projectReferences(tx, createContext(sources), "project"))
        .selectAll()
        .orderBy("project.title")
        .execute(),
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(projectReferenceSchema.parse(row)).toEqual(row);
    // One field more or one fewer than the piece gives is refused.
    const [row] = rows;
    expect(projectReferenceSchema.safeParse({ ...row, description: null }).success).toBe(false);
    const { deletedAt: _left, ...withoutMark } = row!;
    expect(projectReferenceSchema.safeParse(withoutMark).success).toBe(false);
  } finally {
    await database.close();
  }
});

/** The `n`th deterministic id of the contract kit's seed. */
const seedId = (n: number) => `01a1cfa1-0a00-7000-8000-${String(n).padStart(12, "0")}`;
const project = (n: number) => projectIdSchema.parse(seedId(n));
const entry = (n: number) => projectEntryIdSchema.parse(seedId(n));

test("the test module above passes the storage contract kit with `projects` below it", async () => {
  await expect(
    checkContract(
      projectEntries,
      async (tx, context) => {
        // The examples refer to this project and these entries, which get the first ids.
        const website = await projects.entries.create.run(tx.withTables(), context, {
          title: "Website",
        });
        await projectEntries.entries.create.run(tx, context, {
          projectId: website.id,
          label: "Seed entry",
        });
        const removed = await projectEntries.entries.create.run(tx, context, {
          projectId: website.id,
          label: "Removed entry",
        });
        await projectEntries.entries.delete.run(tx, context, { id: removed.id });
      },
      {
        create: { projectId: project(0), label: "New entry" },
        delete: { id: entry(1) },
        restore: { id: entry(2) },
        list: {},
      },
      {},
      [projects],
    ),
  ).resolves.toEqual([]);
});
