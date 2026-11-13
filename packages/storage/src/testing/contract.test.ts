import type { TablesOf } from "@self-engine/db";
import { noteIdSchema, notesRowMap } from "../../test/notes-module/data/rows.ts";
import { ContractProcedure, oc } from "@orpc/contract";
import { expect, test } from "vite-plus/test";
import { z } from "zod";
import { defineStorageModule } from "../core/index.ts";
import { checkContract } from "./index.ts";
import { notes as referenceNotes } from "../../test/notes-module/data/index.ts";

const announcementNotes = {
  ...referenceNotes,
  contract: {
    list: referenceNotes.contract.list,
  },
  entries: { list: referenceNotes.entries.list },
};

const good = defineStorageModule({
  name: "fixture",
  contract: { echo: oc.input(z.object({ text: z.string() })).output(z.string()) },
  migrations: [],
  rowMap: {},
}).entries({ echo: { kind: "query", reads: [], run: (_tx, _context, input) => input.text } });
const seed = async () => {};

test("the kit names a contract entry without an example", async () => {
  await expect(checkContract(good, seed, {})).resolves.toEqual([
    { entry: "echo", rule: "missing example" },
  ]);
});

test("the kit names an entry that accepts invalid input", async () => {
  const acceptsAnything = defineStorageModule({
    name: "fixture",
    contract: { loose: oc.input(z.unknown()).output(z.string()) },
    migrations: [],
    rowMap: {},
  }).entries({ loose: { kind: "query", reads: [], run: () => "answer" } });
  await expect(checkContract(acceptsAnything, seed, { loose: "valid" })).resolves.toEqual([
    { entry: "loose", rule: "accepts invalid input" },
  ]);
});

test("the kit names an entry whose output breaks the contract", async () => {
  const wrongOutput = {
    ...good,
    entries: { echo: { kind: "query" as const, reads: [], run: () => 42 as never } },
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
      name: "fixture",
      contract: { convert: oc.input(z.undefined()).output(z.object({ text: output })) },
      migrations: [],
      rowMap: {},
    }).entries({ convert: { kind: "query", reads: [], run: () => ({ text: "UNCHANGED" }) } });
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
    name: "fixture",
    contract: { read: oc.output(z.string()) },
    migrations: [],
    rowMap: {},
  }).entries({ read: { kind: "query", reads: [], run: () => "answer" } });
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
        reads: ["notes"],
        async run(
          tx: Parameters<typeof notes.entries.list.run>[0],
          context: Parameters<typeof notes.entries.list.run>[1],
        ) {
          await referenceNotes.entries.create.run(
            tx as Parameters<typeof referenceNotes.entries.create.run>[0],
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
      list: {},
    }),
  ).resolves.toEqual([{ entry: "list", rule: "query writes" }]);
});

test("the kit names an entry whose trigger changes an unannounced table", async () => {
  const notes = announcementNotes;
  const triggerWrite = {
    ...notes,
    contract: { create: referenceNotes.contract.create, list: notes.contract.list },
    entries: { create: referenceNotes.entries.create, list: notes.entries.list },
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
    checkContract(
      triggerWrite,
      seed,
      {
        create: { title: "Triggers another write", isPinned: false },
        list: {},
      },
      {
        create: [
          {
            input: { title: "Triggers another write", isPinned: false },
            prepare: async (tx, context) => {
              await referenceNotes.entries.create.run(tx, context, {
                title: "Triggers another write",
                isPinned: false,
              });
            },
          },
        ],
      },
    ),
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
          tx: Parameters<typeof referenceNotes.entries.create.run>[0],
          context: Parameters<typeof notes.entries.list.run>[1],
        ) {
          await tx
            .updateTable("notes")
            .set({ title: "Seed" })
            .where("title", "=", "Seed")
            .execute();
          return notes.entries.list.run(tx, context, {}, "list", "notes");
        },
      },
    },
  };
  await expect(
    checkContract(
      unchanged,
      async (tx, context) => {
        await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { list: {} },
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
          ...notes.entries.list,
          kind: "query" as const,
          reads: ["notes"],
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
          await referenceNotes.entries.create.run(tx, context, {
            title: "Example",
            isPinned: false,
          });
        },
        { list: {} },
      ),
    ).resolves.toEqual([
      {
        entry: "list",
        rule:
          leak === "space"
            ? "entry does not treat another Space's rows as absent"
            : "entry does not treat deleted rows as absent",
      },
      { entry: "list", rule: "query output changes with foreign or deleted rows" },
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
        reads: ["notes"],
        row: notesRowMap.notes,
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
        await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { pages: {} },
    ),
  ).resolves.toEqual([{ entry: "pages", rule: "page query sorts without an index" }]);
});

test("the kit names a unique index without a conflict reason", async () => {
  const { notes } = await import("../../test/notes-module/data/index.ts");
  const fixture = {
    ...notes,
    conflicts: {},
    contract: { list: notes.contract.list },
    entries: { list: notes.entries.list },
  };
  await expect(checkContract(fixture, seed, { list: {} })).resolves.toEqual([
    { entry: "notes_live_title", rule: "unique index has no conflict reason" },
  ]);
});

test("the kit names a contract reason no example triggers", async () => {
  const fixture = defineStorageModule({
    ...good,
    contract: {
      echo: good.contract.echo.errors({
        CONFLICT: { data: z.object({ reason: z.enum(["already_billed", "locked"]) }) },
      }),
    },
  }).entries(good.entries);
  await expect(checkContract(fixture, seed, { echo: { text: "Valid" } })).resolves.toEqual([
    { entry: "echo", rule: "conflict reason not triggered: already_billed" },
    { entry: "echo", rule: "conflict reason not triggered: locked" },
  ]);
});

test.each(["success", "wrong reason", "unexpected", "right reason"] as const)(
  "the kit counts only a declared conflict triggered by the example: %s",
  async (outcome) => {
    const { ORPCError } = await import("@orpc/server");
    const fixture = defineStorageModule({
      ...good,
      contract: {
        echo: good.contract.echo.errors({
          CONFLICT: { data: z.object({ reason: z.literal("already_billed") }) },
        }),
      },
    }).entries({
      echo: {
        kind: "operation",
        run: (_tx, _context, input) => {
          if (input.text === "normal" || outcome === "success") return input.text;
          if (outcome === "unexpected") throw new Error("Unexpected");
          throw new ORPCError("CONFLICT", {
            data: { reason: outcome === "right reason" ? "already_billed" : "other" },
          });
        },
      },
    });
    const result = checkContract(
      fixture,
      seed,
      { echo: { text: "normal" } },
      { echo: [{ input: { text: "conflict" } }] },
    );
    if (outcome === "unexpected") {
      await expect(result).rejects.toThrow("Unexpected");
      return;
    }
    await expect(result).resolves.toEqual(
      outcome === "right reason"
        ? []
        : [
            ...(outcome === "wrong reason"
              ? [{ entry: "echo", rule: "conflict data does not match the declared schema" }]
              : []),
            { entry: "echo", rule: "conflict reason not triggered: already_billed" },
          ],
    );
  },
);

test("the kit names an undeclared conflict reason next to a triggered declared one", async () => {
  const { ORPCError } = await import("@orpc/server");
  const fixture = defineStorageModule({
    ...good,
    contract: {
      echo: good.contract.echo.errors({
        CONFLICT: { data: z.object({ reason: z.literal("already_billed") }) },
      }),
    },
  }).entries({
    echo: {
      kind: "operation",
      run: (_tx, _context, input) => {
        if (input.text === "normal") return input.text;
        throw new ORPCError("CONFLICT", {
          data: { reason: input.text === "declared" ? "already_billed" : "other" },
        });
      },
    },
  });
  await expect(
    checkContract(
      fixture,
      seed,
      { echo: { text: "normal" } },
      { echo: [{ input: { text: "declared" } }, { input: { text: "undeclared" } }] },
    ),
  ).resolves.toEqual([{ entry: "echo", rule: "conflict data does not match the declared schema" }]);
});

test("the kit rejects CONFLICT without a finite list of reason codes", async () => {
  const fixture = defineStorageModule({
    ...good,
    contract: {
      echo: good.contract.echo.errors({ CONFLICT: {} }),
    },
  }).entries(good.entries);
  await expect(checkContract(fixture, seed, { echo: { text: "Valid" } })).resolves.toEqual([
    { entry: "echo", rule: "CONFLICT must list reason codes" },
  ]);
});

test("the kit rejects an array query without an explicit list kind", async () => {
  const fixture = defineStorageModule({
    ...good,
    contract: { loose: oc.input(z.undefined()).output(z.array(z.string())) },
  }).entries({ loose: { kind: "query", reads: [], run: () => [] } });
  await expect(checkContract(fixture, seed, { loose: undefined })).resolves.toEqual([
    { entry: "loose", rule: "array query has no list kind" },
  ]);
});

test("the kit rejects a count that includes another Space or deleted rows", async () => {
  const fixture = defineStorageModule({
    ...referenceNotes,
    contract: { count: oc.input(z.undefined()).output(z.number()) },
  }).entries({
    count: {
      kind: "query",
      reads: ["notes"],
      async run(tx) {
        const row = await tx
          .selectFrom("notes")
          .select((eb) => eb.fn.countAll<number>().as("count"))
          .executeTakeFirst();
        return row?.count ?? 0;
      },
    },
  });
  await expect(
    checkContract(
      fixture,
      async (tx, context) => {
        await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { count: undefined },
    ),
  ).resolves.toContainEqual({
    entry: "count",
    rule: "query output changes with foreign or deleted rows",
  });
});

test("the kit rejects a by-id lookup of its own deleted row", async () => {
  const fixture = defineStorageModule({
    ...referenceNotes,
    contract: { lookup: oc.input(z.object({ id: noteIdSchema })).output(z.string().nullable()) },
  }).entries({
    lookup: {
      kind: "query",
      reads: ["notes"],
      async run(tx, _context, input) {
        const row = await tx
          .selectFrom("notes")
          .select("title")
          .where("id", "=", input.id)
          .executeTakeFirst();
        return row?.title ?? null;
      },
    },
  });
  await expect(
    checkContract(
      fixture,
      async (tx, context) => {
        const note = await referenceNotes.entries.create.run(tx, context, {
          title: "Seed",
          isPinned: false,
        });
        await referenceNotes.entries.delete.run(tx, context, { id: note.id });
      },
      { lookup: { id: "01a1cfa1-0a00-7000-8000-000000000000" } },
    ),
  ).resolves.toContainEqual({
    entry: "lookup",
    rule: "query output changes with foreign or deleted rows",
  });
});

test("the kit rejects a by-id lookup of another Space's scalar value", async () => {
  const fixture = defineStorageModule({
    ...referenceNotes,
    contract: {
      lookup: oc.input(z.object({ id: noteIdSchema })).output(z.string().nullable()),
    },
  }).entries({
    lookup: {
      kind: "query",
      reads: ["notes"],
      async run(tx, _context, input) {
        const row = await tx
          .selectFrom("notes")
          .select("title")
          .where("id", "=", input.id)
          .executeTakeFirst();
        return row?.title ?? null;
      },
    },
  });
  await expect(
    checkContract(
      fixture,
      async (tx, context) => {
        await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { lookup: { id: "01a1cfa1-0a00-7000-8000-000000000001" } },
    ),
  ).resolves.toContainEqual({
    entry: "lookup",
    rule: "query output changes with foreign or deleted rows",
  });
});

test("the kit catches by-id reads, by-id writes and bulk writes without scoping", async () => {
  const fixture = defineStorageModule({
    ...referenceNotes,
    contract: {
      get: oc.input(z.object({ id: noteIdSchema })).output(z.string().nullable()),
      rename: oc.input(z.object({ id: noteIdSchema, title: z.string() })).output(z.undefined()),
      unpinAll: oc.input(z.undefined()).output(z.undefined()),
    },
  }).entries({
    get: {
      kind: "query",
      reads: ["notes"],
      async run(tx, _context, input) {
        const row = await tx
          .selectFrom("notes")
          .select("title")
          .where("id", "=", input.id)
          .executeTakeFirst();
        return row?.title ?? null;
      },
    },
    rename: {
      kind: "operation",
      async run(tx, _context, input) {
        await tx
          .updateTable("notes")
          .set({ title: input.title })
          .where("id", "=", input.id)
          .execute();
        return undefined;
      },
    },
    unpinAll: {
      kind: "operation",
      async run(tx) {
        await tx.updateTable("notes").set({ is_pinned: 0 }).execute();
        return undefined;
      },
    },
  });
  const violations = await checkContract(
    fixture,
    async (tx, context) => {
      await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: true });
    },
    {
      get: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000") },
      rename: { id: noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000"), title: "Renamed" },
      unpinAll: undefined,
    },
  );
  for (const entry of ["get", "rename", "unpinAll"]) {
    expect(violations).toContainEqual({
      entry,
      rule: "entry does not treat deleted rows as absent",
    });
    expect(violations).toContainEqual({
      entry,
      rule: "entry does not treat another Space's rows as absent",
    });
  }
  expect(violations).toContainEqual({
    entry: "unpinAll",
    rule: "operation changes a row from another Space",
  });
  expect(violations).toContainEqual({ entry: "unpinAll", rule: "operation changes a deleted row" });
});

test.each(["asc", "desc"] as const)(
  "page cursor queries seek beyond Space for three columns (%s)",
  async (direction) => {
    const { pageList, sharedEntry } = await import("../core/index.ts");
    const { toNote } = await import("../../test/notes-module/data/rows.ts");
    const fixture = {
      ...referenceNotes,
      migrations: [
        ...referenceNotes.migrations,
        {
          name: "notes/0003",
          sql: `CREATE INDEX notes_three ON notes (space_id, created_at ASC, title ${direction}, id ASC) WHERE deleted_at IS NULL;`,
        },
      ],
      contract: { pages: referenceNotes.contract.pages },
      entries: {
        pages: pageList({
          reads: ["notes"],
          row: notesRowMap.notes,
          query: (
            tx: Parameters<typeof referenceNotes.entries.pages.run>[0],
            context: Parameters<typeof referenceNotes.entries.pages.run>[1],
          ) => sharedEntry(tx, context).live("notes").selectAll(),
          order: [
            { column: "created_at", direction: "asc" },
            { column: "title", direction },
            { column: "id", direction: "asc" },
          ],
          map: toNote,
        }),
      },
    };
    const { createTestDatabase, createTestContext } = await import("./index.ts");
    const { createContext } = await import("../core/index.ts");
    const { CompiledQuery } = await import("kysely");
    const database = await createTestDatabase(fixture);
    try {
      await database.kysely.transaction().execute(async (tx) => {
        const context = createContext(createTestContext());
        await referenceNotes.entries.create.run(
          tx.withTables<TablesOf<typeof notesRowMap>>(),
          context,
          { title: "Seed", isPinned: false },
        );
        const queries = await fixture.entries.pages.list.queries(
          tx.withTables<TablesOf<typeof notesRowMap>>(),
          context,
          {},
          "pages",
          "notes",
        );
        expect(queries).toHaveLength(3);
        for (const query of queries.slice(1)) {
          const plan = await tx.executeQuery<{ detail: string }>(
            CompiledQuery.raw(`EXPLAIN QUERY PLAN ${query.sql}`, [...query.parameters]),
          );
          expect(
            plan.rows.some(({ detail }) =>
              /(?:created_at|\([^)]*created_at[^)]*\))[<>]/.test(detail),
            ),
          ).toBe(true);
        }
      });
    } finally {
      await database.close();
    }
    await expect(
      checkContract(
        fixture,
        async (tx, context) => {
          await referenceNotes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
        },
        { pages: {} },
      ),
    ).resolves.toEqual([]);
  },
);

test("the kit rejects indexed cursor sorting that still scans from the start", async () => {
  const fixture = {
    ...referenceNotes,
    contract: { pages: referenceNotes.contract.pages },
    entries: {
      pages: {
        ...referenceNotes.entries.pages,
        list: {
          kind: "pages" as const,
          async queries(
            tx: Parameters<typeof referenceNotes.entries.pages.run>[0],
            context: Parameters<typeof referenceNotes.entries.pages.run>[1],
          ) {
            const query = tx
              .selectFrom("notes")
              .selectAll()
              .where("space_id", "=", context.spaceId)
              .where("deleted_at", "is", null)
              .orderBy("created_at")
              .orderBy("id")
              .limit(101);
            const scan = query.where((eb) =>
              eb.or([
                eb("created_at", ">", context.now),
                eb.and([
                  eb("created_at", "=", context.now),
                  eb("id", ">", noteIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000")),
                ]),
              ]),
            );
            return [query.compile(), scan.compile(), scan.compile()];
          },
        },
      },
    },
  };
  await expect(checkContract(fixture, seed, { pages: {} })).resolves.toContainEqual({
    entry: "pages",
    rule: "page cursor query has no index range beyond space_id",
  });
});

test.each([false, true])(
  "the kit names ambiguous joined cursor columns (seeded: %s)",
  async (seeded) => {
    const { pageList } = await import("../core/index.ts");
    const { toNote } = await import("../../test/notes-module/data/rows.ts");
    const fixture = {
      ...referenceNotes,
      contract: { pages: referenceNotes.contract.pages },
      entries: {
        pages: pageList({
          reads: ["notes"],
          row: notesRowMap.notes,
          query: (
            tx: Parameters<typeof referenceNotes.entries.pages.run>[0],
            context: Parameters<typeof referenceNotes.entries.pages.run>[1],
          ) =>
            tx
              .selectFrom("notes")
              .innerJoin("notes as other", "other.id", "notes.id")
              .selectAll("notes")
              .where("notes.space_id", "=", context.spaceId)
              .where("notes.deleted_at", "is", null),
          order: [
            { column: "created_at", direction: "asc" },
            { column: "id", direction: "asc" },
          ],
          map: toNote,
        }),
      },
    };
    await expect(
      checkContract(
        fixture,
        async (tx, context) => {
          if (seeded)
            await referenceNotes.entries.create.run(tx, context, {
              title: "Seed",
              isPinned: false,
            });
        },
        { pages: {} },
      ),
    ).resolves.toContainEqual({
      entry: "pages",
      rule: "page list has an ambiguous sort column; wrap the join in a subquery",
    });
  },
);

test.each(["missing", "wrong reason"])(
  "the kit detects an undeclared conflict on a repeated operation: %s",
  async (declaration) => {
    const create = referenceNotes.contract.create;
    const fixture = {
      ...referenceNotes,
      contract: {
        create:
          declaration === "missing"
            ? new ContractProcedure({ ...create["~orpc"], errorMap: {} })
            : create.errors({ CONFLICT: { data: z.object({ reason: z.literal("other") }) } }),
      },
      entries: { create: referenceNotes.entries.create },
    };
    await expect(
      checkContract(fixture, seed, { create: { title: "Taken", isPinned: false } }),
    ).resolves.toContainEqual({
      entry: "create",
      rule: "operation returns an undeclared conflict or reason",
    });
  },
);

test("the kit names same-column unique indexes with different reasons", async () => {
  const fixture = {
    ...referenceNotes,
    migrations: [
      ...referenceNotes.migrations,
      {
        name: "notes/0003",
        sql: "CREATE UNIQUE INDEX notes_pinned_title ON notes(space_id, title) WHERE deleted_at IS NULL AND is_pinned = 1;",
      },
    ],
    conflicts: { notes_live_title: "title_taken", notes_pinned_title: "pinned_title_taken" },
    contract: { list: referenceNotes.contract.list },
    entries: { list: referenceNotes.entries.list },
  };
  await expect(checkContract(fixture, seed, { list: {} })).resolves.toContainEqual({
    entry: "notes_live_title, notes_pinned_title",
    rule: "same-column unique indexes map to different conflict reasons",
  });
});

test("the kit names extra output fields accurately", async () => {
  const fixture = defineStorageModule({
    ...good,
    contract: { echo: oc.input(z.string()).output(z.object({ text: z.string() })) },
  }).entries({
    echo: {
      kind: "query",
      reads: [],
      run: (_tx, _context, text) => ({ text, extra: "private" }),
    },
  });
  await expect(checkContract(fixture, seed, { echo: "Hello" })).resolves.toEqual([
    { entry: "echo", rule: "output contains fields outside the contract" },
  ]);
});

test("expression indexes remain distinguishable by their diagnostic names", async () => {
  const fixture = {
    ...referenceNotes,
    migrations: [
      ...referenceNotes.migrations,
      {
        name: "notes/0003",
        sql: "CREATE UNIQUE INDEX notes_lower ON notes(space_id, lower(title)) WHERE deleted_at IS NULL; CREATE UNIQUE INDEX notes_upper ON notes(space_id, upper(title)) WHERE deleted_at IS NULL;",
      },
    ],
    conflicts: {
      notes_live_title: "title_taken",
      notes_lower: "lower_taken",
      notes_upper: "upper_taken",
    },
    contract: { list: referenceNotes.contract.list },
    entries: { list: referenceNotes.entries.list },
  };
  await expect(checkContract(fixture, seed, { list: {} })).resolves.toEqual([]);
});
