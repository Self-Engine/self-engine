import { oc } from "@orpc/contract";
import { expect, test } from "vite-plus/test";
import { z } from "zod";
import { defineStorageModule, smallSetList } from "./index.ts";

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
    entries: {
      read: { kind: "query", reads: ["notes"], run: () => "answer" },
      list: smallSetList(["notes", "note_links"], () => []),
      write: { kind: "operation", run: () => "done" },
    },
  });
  expect(module.entries.read.reads).toEqual(["notes"]);
  expect(module.entries.list.reads).toEqual(["notes", "note_links"]);
  expect("reads" in module.entries.write).toBe(false);

  defineStorageModule({
    name: "fixture",
    contract,
    migrations: [],
    rowMap: {},
    entries: {
      // @ts-expect-error A query cannot be defined without the tables it reads.
      read: { kind: "query", run: () => "answer" },
      // @ts-expect-error A list builder needs the tables as well.
      list: smallSetList(() => []),
      write: { kind: "operation", run: () => "done" },
    },
  });
});
