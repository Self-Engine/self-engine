import { z } from "zod";

/** The longest note, in characters after trimming. */
export const NOTE_MAX = 10_000;

/** The note of a Time Entry or a Timer: trimmed, and spaces alone are no note. */
export const noteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX)
  .transform((text) => (text === "" ? null : text))
  .nullable();
