import { z } from "zod";

/**
 * An entry's fields, each with the schema of its value (D329). A field whose schema accepts
 * `null` is optional: it may be empty. Every other field is required.
 */
export type FieldList = Readonly<Record<string, z.ZodType>>;

type CreateShape<Fields extends FieldList> = {
  -readonly [Key in keyof Fields]: null extends z.input<Fields[Key]>
    ? z.ZodOptional<Fields[Key]>
    : Fields[Key];
};
type EditShape<Id extends z.ZodType, Fields extends FieldList> = { id: Id } & {
  -readonly [Key in keyof Fields]: z.ZodOptional<Fields[Key]>;
};

/**
 * Derives the inputs of create and edit from one field list, so the two never drift apart
 * (D329, ADR 0032). Both are strict: an unknown field is an input error.
 *
 * - `create`: a required field must be sent; an optional field may be missing and then counts
 *   as empty.
 * - `edit`: the id, and every field optional. A missing field stays untouched, `null` clears an
 *   optional field, a value sets it. A required field never accepts `null`.
 *
 * A rule across fields is declared on the derived input with `.refine`, and checks the fields
 * only when they travel together (D323).
 */
export function entryFields<const Id extends z.ZodType, const Fields extends FieldList>(
  id: Id,
  fields: Fields,
) {
  const create: Record<string, z.ZodType> = {};
  const edit: Record<string, z.ZodType> = { id };
  for (const [key, schema] of Object.entries(fields)) {
    create[key] = schema.safeParse(null).success ? schema.optional() : schema;
    edit[key] = schema.optional();
  }
  return {
    fields,
    // The loop builds exactly the mapped shapes; Zod cannot infer them from a dynamic object.
    create: z.strictObject(create as CreateShape<Fields>),
    edit: z.strictObject(edit as EditShape<Id, Fields>),
  };
}
