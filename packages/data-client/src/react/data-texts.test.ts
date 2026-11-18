// The texts a module's data needs on the page (D334, D335): a name for each synced table and a
// text for each Reason its rules answer with, typed from the module's storage module. Here the
// `notes` test module, whose rule answers with `pinned`.

import { msg } from "@lingui/core/macro";
import type { notes } from "@self-engine/storage/testing";
import { notesTableNames } from "@self-engine/storage/testing/table-names";
import { expect, test } from "vite-plus/test";
import { type DataTexts, dataTexts, NO_DATA_TEXTS } from "./data-texts.ts";

const pinned = () => "A pinned note stays.";

test("a module's data texts name every synced table and give every Reason of its rules a text", () => {
  const texts = dataTexts<typeof notes>()({
    tableNames: notesTableNames,
    reasonTexts: { pinned },
  });
  expect(texts.tableNames).toBe(notesTableNames);
  expect(texts.reasonTexts).toEqual({ pinned });
  const stored: DataTexts = texts;
  expect(stored).toBe(texts);
});

test("the module's storage module decides what the texts must hold (compile-time checks)", () => {
  // The type check of `pnpm verify` fails if any expectation breaks.
  // @ts-expect-error The storage module is named as the type argument, never left out.
  dataTexts()({ tableNames: {} });
  // @ts-expect-error A synced table without a name does not compile.
  dataTexts<typeof notes>()({ tableNames: {}, reasonTexts: { pinned } });
  // @ts-expect-error A Reason of the module's rules without a text does not compile.
  dataTexts<typeof notes>()({ tableNames: notesTableNames });
  dataTexts<typeof notes>()({
    tableNames: {
      ...notesTableNames,
      // @ts-expect-error A name for a table the module does not have does not compile.
      notez: () => msg`notes`,
    },
    reasonTexts: { pinned },
  });
  dataTexts<typeof notes>()({
    tableNames: notesTableNames,
    // @ts-expect-error The details of `pinned` have a title, no `name`.
    reasonTexts: { pinned: (r) => r.details.name },
  });
  expect(NO_DATA_TEXTS.tableNames).toEqual({});
});

test("only `dataTexts` makes data texts: a literal of the same shape is no proof", () => {
  // @ts-expect-error Without the brand, nothing checked the names against a storage module.
  const forged: DataTexts = { tableNames: {}, reasonTexts: {} };
  expect(forged).toBeDefined();
});
