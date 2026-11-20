// What a field reads from the draft. A Contract's input carries no brands, so to the compiler a
// draft holds plain text where `time` has a Calendar Day, a Wall-Clock Time or an Instant: a field
// checks the value by its schema before it hands it to a function of `time`.

import type { z } from "zod";

/** `value` as `schema` reads it, or `null` where it is none, such as "empty" or unfinished text. */
export function checkedOrNull<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.output<Schema> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
