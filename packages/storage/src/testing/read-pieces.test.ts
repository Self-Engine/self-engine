import { createRouterClient } from "@orpc/server";
import { expect, test } from "vite-plus/test";
import type { TablesOf } from "@self-engine/db";
import {
  createContext,
  createFrame,
  sharedEntry,
  smallSetList,
  type ReadTransaction,
  type StorageContext,
} from "../core/index.ts";
import { checkContract, createTestContext, createTestDatabase, type Seed } from "./index.ts";
import { noteIdSchema } from "../../test/notes-module/contracts/index.ts";
import { notes, noteTitles } from "../../test/notes-module/data/index.ts";
import { links } from "../../test/note-links-module/data/index.ts";
import { linksRowMap, toLink } from "../../test/note-links-module/data/rows.ts";

type LinksRead = ReadTransaction<TablesOf<typeof linksRowMap>>;

test("lists links sorted and filtered by the released note title in one query", async () => {
  const database = await createTestDatabase(links, [notes]);
  try {
    const sources = createTestContext();
    const noteClient = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    const client = createRouterClient(
      createFrame(links, { database, sources, checkOutputs: true }),
    );
    const zebra = await noteClient.create({ title: "Zebra", isPinned: false });
    const alpha = await noteClient.create({ title: "Alpha", isPinned: false });
    await client.create({ noteId: zebra.id, label: "First" });
    await client.create({ noteId: alpha.id, label: "Second" });
    let selects = 0;
    const selected = new Set<object>();
    const observed = {
      ...database,
      kysely: database.kysely.withPlugin({
        transformQuery(args) {
          if (args.node.kind === "SelectQueryNode") selected.add(args.queryId);
          return args.node;
        },
        async transformResult(args) {
          if (selected.has(args.queryId)) selects++;
          return args.result;
        },
      }),
    };
    const reader = createRouterClient(
      createFrame(links, { database: observed, sources, checkOutputs: true }),
    );
    expect((await reader.list({})).map((row) => row.noteTitle)).toEqual(["Alpha", "Zebra"]);
    expect(selects).toBe(1);
    selects = 0;
    expect((await reader.list({ title: "Zebra" })).map((row) => row.label)).toEqual(["First"]);
    expect(selects).toBe(1);
  } finally {
    await database.close();
  }
});

test("a link keeps its deleted note title and an explicit deleted mark", async () => {
  const database = await createTestDatabase(links, [notes]);
  try {
    const sources = createTestContext();
    const noteClient = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    const client = createRouterClient(
      createFrame(links, { database, sources, checkOutputs: true }),
    );
    const note = await noteClient.create({ title: "Archived target", isPinned: false });
    const link = await client.create({ noteId: note.id, label: "Recorded work" });
    await noteClient.delete({ id: note.id });
    expect(await client.list({})).toEqual([
      { ...link, noteTitle: "Archived target", noteDeletedAt: "2026-11-12T12:00:00.000Z" },
    ]);
    expect(await client.list({ title: "Archived target" })).toHaveLength(1);
  } finally {
    await database.close();
  }
});

test("a target that later lands in another Space is not joined or available to the title filter", async () => {
  const database = await createTestDatabase(links, [notes]);
  try {
    const sources = createTestContext();
    const noteClient = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    const client = createRouterClient(
      createFrame(links, { database, sources, checkOutputs: true }),
    );
    const note = await noteClient.create({ title: "Private target", isPinned: false });
    const link = await client.create({ noteId: note.id, label: "Visible link" });
    await database.kysely
      .withTables<{ notes: { id: string; space_id: string } }>()
      .updateTable("notes")
      .set({ space_id: "00000000-0000-7000-8000-000000000002" })
      .where("id", "=", note.id)
      .execute();
    expect(await client.list({})).toEqual([{ ...link, noteTitle: null, noteDeletedAt: null }]);
    expect(await client.list({ title: "Private target" })).toEqual([]);
  } finally {
    await database.close();
  }
});

test("creating a link answers not found for a missing, deleted or foreign-Space target", async () => {
  const database = await createTestDatabase(links, [notes]);
  try {
    const sources = createTestContext();
    const { spaceIdSchema } = await import("../core/index.ts");
    const noteClient = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    const client = createRouterClient(
      createFrame(links, { database, sources, checkOutputs: true }),
    );
    const deleted = await noteClient.create({ title: "Deleted target", isPinned: false });
    await noteClient.delete({ id: deleted.id });
    const foreign = await database.kysely.transaction().execute(async (tx) =>
      notes.entries.create.run(
        tx.withTables(),
        {
          ...createContext(sources),
          spaceId: spaceIdSchema.parse("00000000-0000-7000-8000-000000000002"),
        },
        { title: "Private target", isPinned: false },
      ),
    );
    const missing = noteIdSchema.parse("00000000-0000-7000-8000-0000000000ff");
    for (const noteId of [missing, deleted.id, foreign.id])
      await expect(client.create({ noteId, label: "Link" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    expect(await client.list({})).toEqual([]);
  } finally {
    await database.close();
  }
});

const linksSeed: Seed<typeof links.rowMap> = async (tx, context) => {
  // The example links to this live note, which gets the first deterministic id.
  await notes.entries.create.run(tx.withTables(), context, {
    title: "Live target",
    isPinned: false,
  });
  const note = await notes.entries.create.run(tx.withTables(), context, {
    title: "Target",
    isPinned: false,
  });
  await links.entries.create.run(tx, context, {
    noteId: noteIdSchema.parse(note.id),
    label: "Seed link",
  });
  // Foreign targets stay released even when deleted; only owned rows are isolated.
  await notes.entries.delete.run(tx.withTables(), context, { id: note.id });
};
const linksExamples = {
  create: {
    noteId: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000"),
    label: "New link",
  },
  list: {},
};

test("note links passes the storage contract kit using only its own row map", async () => {
  await expect(checkContract(links, linksSeed, linksExamples, {}, [notes])).resolves.toEqual([]);
});

test("the kit names a query that reads a joined table it does not declare", async () => {
  const undeclared = {
    ...links,
    entries: { ...links.entries, list: { ...links.entries.list, reads: ["note_links"] } },
  };
  await expect(checkContract(undeclared, linksSeed, linksExamples, {}, [notes])).resolves.toEqual([
    { entry: "list", rule: "query reads an undeclared table: notes" },
  ]);
});

// Reads the notes table only when a title filter is given.
async function linksFilteredByTitle(
  tx: LinksRead,
  context: StorageContext,
  input: { title?: string | undefined },
) {
  let query = sharedEntry(tx, context).live("note_links").selectAll();
  if (input.title !== undefined) {
    const target = noteTitles(tx, context, "target");
    const titled = tx
      .selectFrom(target)
      .select("target.id")
      .where("target.title", "=", input.title);
    query = query.where("note_id", "in", titled);
  }
  return (await query.execute()).map((row) => ({
    ...toLink(row),
    noteTitle: null,
    noteDeletedAt: null,
  }));
}

test("the kit sees a table read only under some inputs when an example takes that path", async () => {
  // The kit records the SQL that ran for the example, not other branches of the code.
  const filtered = {
    ...links,
    entries: { ...links.entries, list: smallSetList(["note_links"], linksFilteredByTitle) },
  };
  await expect(checkContract(filtered, linksSeed, linksExamples, {}, [notes])).resolves.toEqual([]);
  await expect(
    checkContract(filtered, linksSeed, { ...linksExamples, list: { title: "Target" } }, {}, [
      notes,
    ]),
  ).resolves.toEqual([{ entry: "list", rule: "query reads an undeclared table: notes" }]);
});

test("the consuming module's write transaction exposes only its own tables", async () => {
  const { expectTypeOf } = await import("vite-plus/test");
  type WriteTransaction = Parameters<typeof links.entries.create.run>[0];
  expectTypeOf<Parameters<WriteTransaction["insertInto"]>[0]>().toEqualTypeOf<"note_links">();
  expectTypeOf<Parameters<WriteTransaction["updateTable"]>[0]>().extract<"notes">().toBeNever();
  expectTypeOf<Parameters<WriteTransaction["deleteFrom"]>[0]>().extract<"notes">().toBeNever();
});
