import { oc } from "@orpc/contract";
import { expect, test } from "vite-plus/test";
import { z } from "zod";
import { defineStorageModule } from "../core/index.ts";
import { checkContract } from "./index.ts";
import { notes as referenceNotes } from "../../test/notes-module/data/index.ts";

const announcementNotes = {
  ...referenceNotes,
  contract: { create: referenceNotes.contract.create, list: referenceNotes.contract.list },
  entries: { create: referenceNotes.entries.create, list: referenceNotes.entries.list },
};

const good = defineStorageModule({
  contract: { echo: oc.input(z.object({ text: z.string() })).output(z.string()) },
  migrations: [],
  rowMap: {},
  entries: { echo: { kind: "query", run: (_tx, _context, input) => input.text } },
});
const seed = async () => {};

test("the kit names a contract entry without an example", async () => {
  await expect(checkContract(good, seed, {})).resolves.toEqual([
    { entry: "echo", rule: "missing example" },
  ]);
});

test("the kit names an entry that accepts invalid input", async () => {
  const acceptsAnything = defineStorageModule({
    contract: { loose: oc.input(z.unknown()).output(z.string()) },
    migrations: [],
    rowMap: {},
    entries: { loose: { kind: "query", run: () => "answer" } },
  });
  await expect(checkContract(acceptsAnything, seed, { loose: "valid" })).resolves.toEqual([
    { entry: "loose", rule: "accepts invalid input" },
  ]);
});

test("the kit names an entry whose output breaks the contract", async () => {
  const wrongOutput = {
    ...good,
    entries: { echo: { kind: "query" as const, run: () => 42 as never } },
  };
  await expect(checkContract(wrongOutput, seed, { echo: { text: "Valid" } })).resolves.toEqual([
    { entry: "echo", rule: "output does not match contract" },
  ]);
});

test.each([
  ["transform", z.string().transform((text) => text.toUpperCase())],
  ["default", z.string().default("Fallback")],
])(
  "the kit rejects an output schema with %s, even when the example is unchanged",
  async (_name, output) => {
    const converts = defineStorageModule({
      contract: { convert: oc.input(z.undefined()).output(z.object({ text: output })) },
      migrations: [],
      rowMap: {},
      entries: { convert: { kind: "query", run: () => ({ text: "UNCHANGED" }) } },
    });
    await expect(checkContract(converts, seed, { convert: undefined })).resolves.toEqual([
      { entry: "convert", rule: "output schema transforms or defaults a value" },
    ]);
  },
);

test("a module with a normal contract passes every kit check", async () => {
  await expect(checkContract(good, seed, { echo: { text: "Valid" } })).resolves.toEqual([]);
});

test("an entry without input passes with an explicit undefined example", async () => {
  const noInput = defineStorageModule({
    contract: { read: oc.output(z.string()) },
    migrations: [],
    rowMap: {},
    entries: { read: { kind: "query", run: () => "answer" } },
  });
  await expect(checkContract(noInput, seed, { read: undefined })).resolves.toEqual([]);
});

test("the kit names a query that attempts a write", async () => {
  const notes = announcementNotes;
  const writes = {
    ...notes,
    entries: {
      ...notes.entries,
      list: {
        kind: "query" as const,
        async run(
          tx: Parameters<typeof notes.entries.list.run>[0],
          context: Parameters<typeof notes.entries.list.run>[1],
        ) {
          await notes.entries.create.run(
            tx as Parameters<typeof notes.entries.create.run>[0],
            context,
            { title: "Forbidden", isPinned: false },
          );
          return [];
        },
      },
    },
  };
  await expect(
    checkContract(writes, seed, {
      create: { title: "Valid", isPinned: false },
      list: {},
    }),
  ).resolves.toEqual([{ entry: "list", rule: "query writes" }]);
});

test("the kit names an entry whose trigger changes an unannounced table", async () => {
  const notes = announcementNotes;
  const triggerWrite = {
    ...notes,
    migrations: [
      ...notes.migrations,
      {
        name: `notes/${String(notes.migrations.length + 1).padStart(4, "0")}`,
        sql: `
      CREATE TABLE local_notes_audit (title TEXT NOT NULL) STRICT;
      CREATE TRIGGER notes_audit AFTER INSERT ON notes BEGIN
        INSERT INTO local_notes_audit (title) VALUES (NEW.title);
      END;
    `,
      },
    ],
  };
  await expect(
    checkContract(triggerWrite, seed, {
      create: { title: "Triggers another write", isPinned: false },
      list: {},
    }),
  ).resolves.toEqual([{ entry: "create", rule: "changed table not announced: local_notes_audit" }]);
});

test("the kit accepts an announcement for an update that rewrites identical values", async () => {
  const notes = announcementNotes;
  const unchanged = {
    ...notes,
    entries: {
      ...notes.entries,
      list: {
        kind: "operation" as const,
        async run(
          tx: Parameters<typeof notes.entries.create.run>[0],
          context: Parameters<typeof notes.entries.list.run>[1],
        ) {
          await tx
            .updateTable("notes")
            .set({ title: "Seed" })
            .where("title", "=", "Seed")
            .execute();
          return notes.entries.list.run(tx, context);
        },
      },
    },
  };
  await expect(
    checkContract(
      unchanged,
      async (tx, context) => {
        await notes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { create: { title: "New", isPinned: false }, list: {} },
    ),
  ).resolves.toEqual([]);
});

test.each(["space", "deleted"] as const)(
  "the kit names a query that leaks a %s row",
  async (leak) => {
    const { notes } = await import("../../test/notes-module/data/index.ts");
    const { toNote } = await import("../../test/notes-module/data/rows.ts");
    const broken = {
      ...notes,
      contract: { list: notes.contract.list },
      entries: {
        list: {
          kind: "query" as const,
          async run(
            tx: Parameters<typeof notes.entries.list.run>[0],
            context: Parameters<typeof notes.entries.list.run>[1],
          ) {
            const query = tx.selectFrom("notes").selectAll();
            const rows = await (
              leak === "space"
                ? query.where("deleted_at", "is", null)
                : query.where("space_id", "=", context.spaceId)
            ).execute();
            return rows.map(toNote);
          },
        },
      },
    };
    await expect(
      checkContract(
        broken,
        async (tx, context) => {
          await notes.entries.create.run(tx, context, { title: "Example", isPinned: false });
        },
        { list: {} },
      ),
    ).resolves.toEqual([
      {
        entry: "list",
        rule: leak === "space" ? "returns a row from another Space" : "returns a deleted row",
      },
    ]);
  },
);

test("the kit names a page query that sorts without an index", async () => {
  const { notes } = await import("../../test/notes-module/data/index.ts");
  const { toNote } = await import("../../test/notes-module/data/rows.ts");
  const { pageList, sharedEntry } = await import("../core/index.ts");
  const broken = {
    ...notes,
    contract: { pages: notes.contract.pages },
    entries: {
      pages: pageList({
        query: (
          tx: Parameters<typeof notes.entries.pages.run>[0],
          context: Parameters<typeof notes.entries.pages.run>[1],
        ) => sharedEntry(tx, context).live("notes").selectAll(),
        order: [
          { column: "is_pinned", direction: "asc" },
          { column: "id", direction: "asc" },
        ],
        map: toNote,
      }),
    },
  };
  await expect(
    checkContract(
      broken,
      async (tx, context) => {
        await notes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { pages: {} },
    ),
  ).resolves.toEqual([{ entry: "pages", rule: "page query sorts without an index" }]);
});
