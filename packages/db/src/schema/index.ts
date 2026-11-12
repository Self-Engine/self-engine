import { z } from "zod";

/** A UUIDv7 shared by an entity's contract and row, with its own id brand. */
export function idSchema<const Name extends string>(_name: Name) {
  return z.uuidv7().brand<`${Name}Id`>();
}

/** SQLite stores booleans as integers; the row-to-entity mapping converts them. */
export const sqliteBoolean = z.union([z.literal(0), z.literal(1)]);
