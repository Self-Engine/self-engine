import { oc } from "@orpc/contract";
import { refusal } from "@self-engine/db/schema";
import { z } from "zod";

export const settingEntrySchema = z.strictObject({ key: z.string(), value: z.json() });

type Json = z.output<ReturnType<typeof z.json>>;
type ReadonlyJson =
  | Exclude<Json, object>
  | readonly ReadonlyJson[]
  | { readonly [key: string]: ReadonlyJson };

const batch = z.strictObject({ entries: z.array(settingEntrySchema) });
// The store hands its adapter a readonly batch, including the arrays and objects in each value.
const saveInput: z.ZodType<
  z.output<typeof batch>,
  { readonly entries: readonly { readonly key: string; readonly value: ReadonlyJson }[] }
> = batch;

export const settingsContract = {
  load: oc.input(z.strictObject({})).output(z.array(settingEntrySchema)),
  save: oc.input(saveInput).output(z.void()).errors(refusal),
};
