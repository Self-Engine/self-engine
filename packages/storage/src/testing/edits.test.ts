import { oc } from "@orpc/contract";
import { ORPCError } from "@orpc/server";
import { expect, test } from "vite-plus/test";
import {
  bodyDiffers,
  bodyRule,
  cardFields,
  cardIdSchema,
  cardSchema,
} from "../../test/cards-module/contracts/index.ts";
import { cards } from "../../test/cards-module/data/index.ts";
import { toCard } from "../../test/cards-module/data/rows.ts";
import { sharedWrites } from "../core/index.ts";
import { checkContract, type Seed } from "./index.ts";

const firstCard = cardIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000");
const seed: Seed<typeof cards.rowMap> = async (tx, context) => {
  await cards.entries.create.run(tx, context, { title: "Seed", body: "Text", color: "red" });
  const removed = await cards.entries.create.run(tx, context, { title: "Deleted" });
  await cards.entries.delete.run(tx, context, { id: removed.id });
};
const examples = {
  list: {},
  create: { title: "New" },
  edit: { id: firstCard, title: "Edited", body: "Edited text", color: "blue" as const },
  delete: { id: firstCard },
};
type EditRun = typeof cards.entries.edit.run;

function withEdit(run: EditRun) {
  return { ...cards, entries: { ...cards.entries, edit: { ...cards.entries.edit, run } } };
}

test("the kit passes a module whose edit follows the pattern", async () => {
  await expect(checkContract(cards, seed, examples)).resolves.toEqual([]);
});

test("the kit fails an input that drops an unknown field silently", async () => {
  const drops = {
    ...cards,
    contract: {
      ...cards.contract,
      edit: oc
        .input(cardFields.edit.strip().refine(bodyDiffers, bodyRule))
        .output(cardSchema)
        .errors({ NOT_FOUND: {} }),
    },
  };
  await expect(checkContract(drops, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "input accepts an unknown field" },
  ]);
});

test("the kit fails an edit that writes when it carries no field", async () => {
  const writes = withEdit(async (tx, context, input) => {
    const row = await tx
      .updateTable("cards")
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
    return toCard(row);
  });
  await expect(checkContract(writes, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields writes" },
  ]);
});

test("the kit fails an edit that clears a field missing from the call", async () => {
  const clears = withEdit(async (tx, context, input) =>
    toCard(
      await sharedWrites(tx, context).update("cards", input.id, {
        title: input.title,
        body: input.body ?? null,
        color: input.color,
      }),
    ),
  );
  await expect(checkContract(clears, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields writes" },
    { entry: "edit", rule: "edit changes a field it did not carry: body" },
  ]);
});

test("the kit fails an edit that ignores null for an optional field", async () => {
  const keeps = withEdit(async (tx, context, input) =>
    toCard(
      await sharedWrites(tx, context).update("cards", input.id, {
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

test("the kit fails an edit that answers an unknown id without fields", async () => {
  const answers = withEdit(async (tx, context, input) => {
    if (Object.keys(input).length > 1)
      return toCard(
        await sharedWrites(tx, context).update("cards", input.id, {
          title: input.title,
          body: input.body,
          color: input.color,
        }),
      );
    // Answers some row for any id: never "not found".
    const any = await tx.selectFrom("cards").selectAll().orderBy("id").executeTakeFirst();
    if (any === undefined) throw new Error("The seed holds a card");
    return toCard(any);
  });
  await expect(checkContract(answers, seed, examples)).resolves.toEqual([
    { entry: "edit", rule: "edit without fields is not 'not found' for an unknown id" },
  ]);
});

test("the kit names a field the edit example does not set", async () => {
  await expect(
    checkContract(cards, seed, { ...examples, edit: { id: firstCard, title: "Edited" } }),
  ).resolves.toEqual([
    { entry: "edit", rule: "edit example does not set every field: body" },
    { entry: "edit", rule: "edit example does not set every field: color" },
  ]);
});
