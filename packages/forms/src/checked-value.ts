// What a field reads from the draft. The compiler binds a field of `time` only to a draft field
// of its value (D365), but the binding hands every value on as `unknown`: a field checks it by its
// schema before it hands it to a function of `time`, which is the conversion without a cast.

import type { z } from "zod";

/** `value` as `schema` reads it, or `null` where it is none, such as "empty" or unfinished text. */
export function checkedOrNull<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.output<Schema> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
