import { createRouterClient } from "@orpc/server";
import { afterEach, expect, test } from "vite-plus/test";
import { notes } from "../../test/notes-module/data/index.ts";
import { createFrame, smallSetList, windowList, type StorageReport } from "./index.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

test.each(["window", "small-set"] as const)(
  "%s returns all rows and reports once at 1,000 only with output checks",
  async (kind) => {
    const database = await createTestDatabase(notes);
    cleanups.push(() => database.close());
    let count = 999;
    const module = {
      ...notes,
      contract: { list: notes.contract.list },
      entries: {
        list: (kind === "window" ? windowList : smallSetList)(async () =>
          Array.from({ length: count }, () => ({
            id: "01a1cfa1-0a00-7000-8000-000000000000" as never,
            createdAt: "2026-11-12T12:00:00.000Z" as never,
            updatedAt: "2026-11-12T12:00:00.000Z" as never,
            title: "Example",
            isPinned: false,
          })),
        ),
      },
    };
    for (const checkOutputs of [true, false]) {
      const reports: StorageReport[] = [];
      const client = createRouterClient(
        createFrame(module, {
          database,
          sources: createTestContext(),
          checkOutputs,
          report: (value) => {
            reports.push(value);
          },
        }),
      );
      count = 999;
      await expect(client.list({})).resolves.toHaveLength(999);
      expect(reports).toEqual([]);
      count = 1000;
      await expect(client.list({})).resolves.toHaveLength(1000);
      expect(reports).toEqual(
        checkOutputs ? [{ kind: "large-result", entry: "list", rows: 1000 }] : [],
      );
      count = 1001;
      const throwing = createRouterClient(
        createFrame(module, {
          database,
          sources: createTestContext(),
          checkOutputs,
          report: () => {
            throw new Error("Log unavailable");
          },
        }),
      );
      await expect(throwing.list({})).resolves.toHaveLength(1001);
      const silent = createRouterClient(
        createFrame(module, {
          database,
          sources: createTestContext(),
          checkOutputs,
        }),
      );
      await expect(silent.list({})).resolves.toHaveLength(1001);
    }
  },
);

test("notes exposes all three lists; pages walk repeated sort values in both directions", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const client = createRouterClient(
    createFrame(notes, {
      database,
      sources: createTestContext(),
      checkOutputs: true,
    }),
  );
  const expected = [];
  for (let i = 0; i < 207; i++) {
    expected.push(await client.create({ title: `Note ${i}`, isPinned: false }));
  }
  const pages = [];
  let page = await client.pages({});
  expect(page.before).toBeNull();
  for (;;) {
    expect(page.rows.length).toBeLessThanOrEqual(100);
    pages.push(page);
    if (page.after === null) break;
    page = await client.pages({ cursor: page.after });
  }
  expect(pages.map((value) => value.rows.length)).toEqual([100, 100, 7]);
  expect(pages.flatMap((value) => value.rows)).toEqual(expected);
  expect(new Set(pages.flatMap((value) => value.rows.map((row) => row.id))).size).toBe(207);
  for (let index = pages.length - 1; index > 0; index--) {
    const cursor = page.before;
    if (cursor === null) throw new Error("Missing previous cursor");
    page = await client.pages({ cursor });
    expect(page).toEqual(pages[index - 1]);
  }
  await expect(client.list({})).resolves.toEqual(expected);
  await expect(
    client.window({ from: "2026-11-12T00:00:00.000Z", to: "2026-11-13T00:00:00.000Z" }),
  ).resolves.toEqual(expected);
  await expect(
    client.window({ from: "2026-11-13T00:00:00.000Z", to: "2026-11-14T00:00:00.000Z" }),
  ).resolves.toEqual([]);
});

test("a renderer cannot raise page size, and storage can set at most 500", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const client = createRouterClient(
    createFrame(notes, {
      database,
      sources: createTestContext(),
      checkOutputs: true,
    }),
  );
  for (let i = 0; i < 507; i++) await client.create({ title: `Note ${i}`, isPinned: false });
  const { pageList, sharedEntry } = await import("./index.ts");
  const { toNote } = await import("../../test/notes-module/data/rows.ts");
  const options = {
    query: (
      tx: Parameters<typeof notes.entries.pages.run>[0],
      context: Parameters<typeof notes.entries.pages.run>[1],
    ) => sharedEntry(tx, context).live("notes").selectAll(),
    order: [
      { column: "created_at", direction: "asc" },
      { column: "id", direction: "asc" },
    ] as const,
    map: toNote,
  };
  for (const size of [3, 500]) {
    const limited = createRouterClient(
      createFrame(
        {
          ...notes,
          entries: { ...notes.entries, pages: pageList({ ...options, size }) },
        },
        { database, sources: createTestContext(), checkOutputs: true },
      ),
    );
    const page = await limited.pages({});
    expect(page.rows).toHaveLength(size);
    if (page.after === null) throw new Error("Missing next cursor");
    expect((await limited.pages({ cursor: page.after })).rows.length).toBeLessThanOrEqual(size);
    await expect(limited.pages({ size: 10000 } as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  }
  for (const size of [0, -1, 501, 1.5, NaN, Infinity]) {
    expect(() => pageList({ ...options, size })).toThrow("Page size");
  }
});

test("tampered cursors and another list's cursor are invalid input", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const client = createRouterClient(
    createFrame(notes, {
      database,
      sources: createTestContext(),
      checkOutputs: false,
    }),
  );
  for (let i = 0; i < 101; i++) await client.create({ title: `Note ${i}`, isPinned: false });
  const page = await client.pages({});
  if (page.after === null) throw new Error("Missing next cursor");
  const { pageList, sharedEntry } = await import("./index.ts");
  const { toNote } = await import("../../test/notes-module/data/rows.ts");
  const other = createRouterClient(
    createFrame(
      {
        ...notes,
        entries: {
          ...notes.entries,
          pages: pageList({
            query: (
              tx: Parameters<typeof notes.entries.pages.run>[0],
              context: Parameters<typeof notes.entries.pages.run>[1],
            ) => sharedEntry(tx, context).live("notes").selectAll(),
            order: [
              { column: "created_at", direction: "asc" },
              { column: "id", direction: "asc" },
            ],
            map: toNote,
          }),
        },
      },
      { database, sources: createTestContext(), checkOutputs: false },
    ),
  );
  await expect(other.pages({ cursor: page.after })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  for (const cursor of [
    "garbage",
    "",
    `${page.after}a`,
    `A${page.after.slice(1)}`,
    page.after.split(".")[0] + ".eA",
  ]) {
    await expect(client.pages({ cursor })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }
});

test.each(["descending", "mixed", "id-only"] as const)(
  "%s keyset order stays stable in both directions, including empty lists",
  async (ordering) => {
    const database = await createTestDatabase(notes);
    cleanups.push(() => database.close());
    const { pageList, sharedEntry } = await import("./index.ts");
    const { toNote } = await import("../../test/notes-module/data/rows.ts");
    const order =
      ordering === "descending"
        ? ([
            { column: "created_at", direction: "desc" },
            { column: "id", direction: "desc" },
          ] as const)
        : ordering === "mixed"
          ? ([
              { column: "is_pinned", direction: "desc" },
              { column: "id", direction: "asc" },
            ] as const)
          : ([{ column: "id", direction: "desc" }] as const);
    const client = createRouterClient(
      createFrame(
        {
          ...notes,
          entries: {
            ...notes.entries,
            pages: pageList({
              query: (
                tx: Parameters<typeof notes.entries.pages.run>[0],
                context: Parameters<typeof notes.entries.pages.run>[1],
              ) => sharedEntry(tx, context).live("notes").selectAll(),
              order,
              map: toNote,
              size: 3,
            }),
          },
        },
        { database, sources: createTestContext(), checkOutputs: true },
      ),
    );
    await expect(client.pages({})).resolves.toEqual({ rows: [], before: null, after: null });
    for (let i = 0; i < 11; i++) await client.create({ title: `Note ${i}`, isPinned: i % 2 === 1 });
    const titles = [];
    const pages = [];
    let page = await client.pages({});
    for (;;) {
      titles.push(...page.rows.map((row) => row.title));
      pages.push(page);
      if (page.after === null) break;
      page = await client.pages({ cursor: page.after });
    }
    expect(titles).toEqual(
      ordering === "mixed"
        ? [
            "Note 1",
            "Note 3",
            "Note 5",
            "Note 7",
            "Note 9",
            "Note 0",
            "Note 2",
            "Note 4",
            "Note 6",
            "Note 8",
            "Note 10",
          ]
        : [
            "Note 10",
            "Note 9",
            "Note 8",
            "Note 7",
            "Note 6",
            "Note 5",
            "Note 4",
            "Note 3",
            "Note 2",
            "Note 1",
            "Note 0",
          ],
    );
    for (let index = pages.length - 1; index > 0; index--) {
      if (page.before === null) throw new Error("Missing previous cursor");
      page = await client.pages({ cursor: page.before });
      expect(page).toEqual(pages[index - 1]);
    }
  },
);

test("storage refuses a page order without a final unique id", async () => {
  const { pageList, sharedEntry } = await import("./index.ts");
  const { toNote } = await import("../../test/notes-module/data/rows.ts");
  const query = (
    tx: Parameters<typeof notes.entries.pages.run>[0],
    context: Parameters<typeof notes.entries.pages.run>[1],
  ) => sharedEntry(tx, context).live("notes").selectAll();
  expect(() =>
    pageList({ query, map: toNote, order: [{ column: "created_at", direction: "asc" }] }),
  ).toThrow("Page order must end in id");
  expect(() => pageList({ query, map: toNote, order: [] })).toThrow("Page order must end in id");
  expect(() =>
    pageList({
      query,
      map: toNote,
      order: [
        { column: "id", direction: "asc" },
        { column: "id", direction: "desc" },
      ],
    }),
  ).toThrow("no repeated columns");
});
