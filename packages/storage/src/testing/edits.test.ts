import { refusal } from "@self-engine/db/schema";
import { oc } from "@orpc/contract";
import { ORPCError } from "@orpc/server";
import { expect, test } from "vite-plus/test";
import { z } from "zod";
import {
  bodyDiffers,
  bodyRule,
  memoFields,
  memoIdSchema,
  memoSchema,
} from "../../test/memos-module/contracts/index.ts";
import { memos } from "../../test/memos-module/data/index.ts";
import { toMemo } from "../../test/memos-module/data/rows.ts";
import { sharedWrites } from "../core/index.ts";
import { checkContract, type Seed } from "./index.ts";

const firstMemo = memoIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000");
const seed: Seed<typeof memos.rowMap> = async (tx, context) => {
  await memos.entries.create.run(tx, context, { title: "Seed", body: "Text", color: "red" });
  const removed = await memos.entries.create.run(tx, context, { title: "Deleted" });
  await memos.entries.delete.run(tx, context, { id: removed.id });
};
const examples = {
  list: {},
  create: { title: "New" },
  edit: { id: firstMemo, title: "Edited", body: "Edited text", color: "blue" as const },
  delete: { id: firstMemo },
};
type EditRun = typeof memos.entries.edit.run;

function withEdit(run: EditRun) {
  return { ...memos, entries: { ...memos.entries, edit: { ...memos.entries.edit, run } } };
}

test("the kit passes a module whose edit follows the pattern", async () => {
  await expect(checkContract(memos, seed, examples)).resolves.toEqual([]);
});

test("the kit fails an input that drops an unknown field silently", async () => {
  const drops = {
    ...memos,
    contract: {
      ...memos.contract,
      edit: oc
        .input(memoFields.edit.strip().refine(bodyDiffers, bodyRule))
        .output(memoSchema)
        .errors({ NOT_FOUND: {}, ...refusal }),
    },
  };
  await expect(checkContract(drops, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "input accepts an unknown field" },
  ]);
});

test("the kit fails an edit that writes when it carries no field", async () => {
  const writes = withEdit(async (tx, context, input) => {
    const row = await tx
      .updateTable("memos")
      .set({
        updated_at: context.now,
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.color === undefined ? {} : { color: input.color }),
      })
      .where("space_id", "=", context.spaceId)
      .where("deleted_at", "is", null)
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirst();
    if (row === undefined) throw new ORPCError("NOT_FOUND");
    return toMemo(row);
  });
  await expect(checkContract(writes, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields writes" },
    { entry: "edit", rule: "edit without fields does not answer the entry" },
  ]);
});

test("the kit fails an edit that clears a field missing from the call", async () => {
  const clears = withEdit(async (tx, context, input) =>
    toMemo(
      await sharedWrites(tx, context).update("memos", input.id, {
        title: input.title,
        body: input.body ?? null,
        color: input.color,
      }),
    ),
  );
  await expect(checkContract(clears, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields writes" },
    { entry: "edit", rule: "edit without fields does not answer the entry" },
    { entry: "edit", rule: "edit changes a field it did not carry: body" },
  ]);
});

test("the kit fails an edit that ignores null for an optional field", async () => {
  const keeps = withEdit(async (tx, context, input) =>
    toMemo(
      await sharedWrites(tx, context).update("memos", input.id, {
        title: input.title,
        body: input.body ?? undefined,
        color: input.color,
      }),
    ),
  );
  await expect(checkContract(keeps, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit does not clear a field sent as null: body" },
  ]);
});

test("the kit fails an edit that ignores a field it carries", async () => {
  // In the full edit as in the edit of the title alone: the two answers agree with each other.
  const ignores = withEdit(async (tx, context, input) =>
    toMemo(
      await sharedWrites(tx, context).update("memos", input.id, {
        body: input.body,
        color: input.color,
      }),
    ),
  );
  await expect(checkContract(ignores, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit does not set a field it carries: title" },
  ]);
});

test("the kit fails an edit that answers an unknown id without fields", async () => {
  const answers = withEdit(async (tx, context, input) => {
    if (Object.keys(input).length > 1)
      return toMemo(
        await sharedWrites(tx, context).update("memos", input.id, {
          title: input.title,
          body: input.body,
          color: input.color,
        }),
      );
    // Answers some row for any id: never "not found".
    const any = await tx.selectFrom("memos").selectAll().orderBy("id").executeTakeFirst();
    if (any === undefined) throw new Error("The seed holds a memo");
    return toMemo(any);
  });
  await expect(checkContract(answers, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields is not 'not found' for an unknown id" },
  ]);
});

test("the kit names a field the edit example does not set", async () => {
  await expect(
    checkContract(memos, seed, { ...examples, edit: { id: firstMemo, title: "Edited" } }),
  ).resolves.toEqual([
    { entry: "edit", rule: "edit example does not set every field: body" },
    { entry: "edit", rule: "edit example does not set every field: color" },
  ]);
});

const editMemo: EditRun = async (tx, context, input) =>
  toMemo(
    await sharedWrites(tx, context).update("memos", input.id, {
      title: input.title,
      body: input.body,
      color: input.color,
    }),
  );

test("the kit fails an edit that answers nothing when it carries no field", async () => {
  const empty = withEdit(async (tx, context, input) => {
    const memo = await editMemo(tx, context, input);
    // Writes nothing, but answers no entry.
    return Object.keys(input).length > 1 ? memo : ({} as typeof memo);
  });
  await expect(checkContract(empty, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields does not answer the entry" },
  ]);
});

test("the kit fails an edit that answers a moved `updated_at` when it carries no field", async () => {
  const stale = withEdit(async (tx, context, input) => {
    const memo = await editMemo(tx, context, input);
    // Writes nothing, but answers as if it had.
    return Object.keys(input).length > 1 ? memo : { ...memo, updatedAt: context.now };
  });
  await expect(checkContract(stale, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields does not answer the entry" },
  ]);
});

// A list field: the memo's body as a list of lines, stored as JSON text. The answer adds a
// computed part to each line, as a Time Entry adds the Project Share to each of its projects.
const linesSchema = z.array(z.strictObject({ text: z.string().trim().min(1) }));
type Line = z.output<typeof linesSchema>[number];
// The kit types its examples by the memos Contract, whose body is text.
const linesExamples = {
  ...examples,
  edit: { ...examples.edit, body: [{ text: "First " }, { text: "Second" }] },
} as unknown as typeof examples;

/** The stored lines; a seeded memo holds plain text, which reads as no lines. */
function linesOf(body: string | null): Line[] {
  if (body === null || !body.startsWith("[")) return [];
  const read = linesSchema.safeParse(JSON.parse(body));
  return read.success ? read.data : [];
}

/** The memos module whose edit takes the body as lines and answers each with `answer`. */
function withLines(answer: (lines: readonly Line[]) => unknown[]) {
  const edit = oc
    .input(memoFields.edit.extend({ body: linesSchema.optional() }))
    .output(memoSchema.extend({ body: z.array(z.unknown()) }))
    .errors({ NOT_FOUND: {}, ...refusal });
  const run = async (
    ...[tx, context, input]: Parameters<EditRun>
  ): Promise<z.output<typeof memoSchema>> => {
    const { body } = input as unknown as { body?: readonly Line[] };
    const row = await sharedWrites(tx, context).update("memos", input.id, {
      title: input.title,
      color: input.color,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ...toMemo(row), body: answer(linesOf(row.body)) } as never;
  };
  return {
    ...memos,
    contract: { ...memos.contract, edit },
    entries: { ...memos.entries, edit: { ...memos.entries.edit, run } },
  } as unknown as typeof memos;
}

const withLength = (line: Line) => ({ ...line, length: line.text.length });

test("for a list field, the answer may add computed parts to each item sent", async () => {
  await expect(
    checkContract(
      withLines((lines) => lines.map(withLength)),
      seed,
      linesExamples,
    ),
  ).resolves.toEqual([]);
});

test.each<[string, (lines: readonly Line[]) => unknown[]]>([
  [
    "a changed sent key",
    (lines) => lines.map((line) => ({ ...withLength(line), text: line.text.toUpperCase() })),
  ],
  ["a missing item", (lines) => lines.slice(1).map(withLength)],
  ["another order", (lines) => lines.toReversed().map(withLength)],
  ["an item that is no object", (lines) => lines.map(({ text }) => text)],
])("for a list field, the kit fails an answer with %s", async (_, answer) => {
  await expect(checkContract(withLines(answer), seed, linesExamples)).resolves.toEqual([
    { entry: "edit", rule: "edit does not set a field it carries: body" },
  ]);
});
