import { z } from "zod";

/**
 * The stored form of a value as JSON text: `decode` reads the text on trust and `schema` checks
 * the value right after, `encode` writes it. Text that is no JSON is an issue of the decode, never
 * thrown, so a reader tells it apart from a value this version knows (`safeDecode`).
 */
export function jsonTextSchema<Schema extends z.ZodType>(schema: Schema) {
  return z.codec(z.string(), schema, {
    decode: (text, context) => {
      try {
        // Read on trust; the schema checks the value right after.
        return JSON.parse(text) as z.input<Schema>;
      } catch {
        // Text that is no JSON is reported as an issue of the decode, not thrown.
        context.issues.push({ code: "invalid_format", format: "json", input: text });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value),
  });
}
