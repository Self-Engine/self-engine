import { oc } from "@orpc/contract";
import { expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { notesRowMap } from "../../test/notes-module/data/rows.ts";
import {
  defineStorageModule,
  pageInputSchema,
  pageList,
  pageSchema,
  smallSetList,
  windowList,
} from "./index.ts";

const contract = {
  read: oc.output(z.string()),
  list: oc.output(z.array(z.string())),
  write: oc.output(z.string()),
};

test("a query entry declares the tables it reads and an operation declares none", () => {
  const module = defineStorageModule({
    name: "fixture",
    contract,
    migrations: [],
    rowMap: {},
  }).entries({
    read: { kind: "query", reads: ["notes"], run: () => "answer" },
    list: smallSetList(["notes", "note_links"], () => []),
    write: { kind: "operation", run: () => "done" },
  });
  expect(module.entries.read.reads).toEqual(["notes"]);
  expect(module.entries.list.reads).toEqual(["notes", "note_links"]);
  expect("reads" in module.entries.write).toBe(false);

  defineStorageModule({
    name: "fixture",
    contract,
    migrations: [],
    rowMap: {},
  }).entries({
    // @ts-expect-error A query cannot be defined without the tables it reads.
    read: { kind: "query", run: () => "answer" },
    // @ts-expect-error A list builder needs the tables as well.
    list: smallSetList(() => []),
    write: { kind: "operation", run: () => "done" },
  });
});

const listContract = {
  window: oc.input(z.object({ from: z.string() })).output(z.array(z.string())),
  set: oc.input(z.object({ tag: z.string() })).output(z.array(z.string())),
  pages: oc.input(pageInputSchema.extend({ q: z.string() })).output(pageSchema(z.string())),
};

test("all three list builders take tx and input from the Contract", () => {
  const module = defineStorageModule({
    name: "fixture",
    contract: listContract,
    migrations: [],
    rowMap: notesRowMap,
  }).entries({
    window: windowList(["notes"], async (tx, _context, input) => {
      const rows = await tx
        .selectFrom("notes")
        .select("title")
        .where("title", ">=", input.from)
        .execute();
      return rows.map((row) => row.title);
    }),
    set: smallSetList(["notes"], async (tx, _context, input) => {
      const rows = await tx
        .selectFrom("notes")
        .select("title")
        .where("title", "=", input.tag)
        .execute();
      return rows.map((row) => row.title);
    }),
    pages: pageList({
      reads: ["notes"],
      row: notesRowMap.notes,
      query: (tx, _context, input) =>
        tx.selectFrom("notes").selectAll().where("title", "=", input.q),
      order: [{ column: "id", direction: "asc" }],
      map: (row) => row.title,
    }),
  });
  expect(module.entries.window.list.kind).toBe("window");
  expectTypeOf<Parameters<typeof module.entries.window.run>[2]>().toEqualTypeOf<{
    from: string;
  }>();
  expectTypeOf<Parameters<typeof module.entries.set.run>[2]>().toEqualTypeOf<{ tag: string }>();
  expectTypeOf<Parameters<typeof module.entries.pages.run>[2]>().toEqualTypeOf<{
    cursor?: string | undefined;
    q: string;
  }>();

  defineStorageModule({
    name: "fixture",
    contract: listContract,
    migrations: [],
    rowMap: notesRowMap,
  }).entries({
    // @ts-expect-error The window's input has no `to`.
    window: windowList(["notes"], (_tx, _context, input) => [input.to]),
    // @ts-expect-error The small set's input has no `from`.
    set: smallSetList(["notes"], (_tx, _context, input) => [input.from]),
    pages: pageList({
      reads: ["notes"],
      row: notesRowMap.notes,
      query: (tx, _context, input) =>
        // @ts-expect-error The page input has no `tag`.
        tx.selectFrom("notes").selectAll().where("title", "=", input.tag),
      order: [{ column: "id", direction: "asc" }],
      map: (row) => row.title,
    }),
  });
});
