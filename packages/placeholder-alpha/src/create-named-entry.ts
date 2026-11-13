import { defineInputCommand } from "@self-engine/shell";
import { z } from "zod";
import { createEntry } from "./port.ts";

export default defineInputCommand({
  description:
    "Creates an entry with the given name. Answers with the entry, or with a conflict when the name is taken.",
  schema: z.object({ name: z.string().min(1) }),
  run: ({ name }, { data }) => createEntry(data, { name }),
});
