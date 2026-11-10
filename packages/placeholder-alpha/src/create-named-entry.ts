import { defineInputCommand } from "@self-engine/shell";
import { z } from "zod";
import { saveEntry } from "./entry-store.ts";
import { NEW_ENTRY_ID } from "./sample-data.ts";

export default defineInputCommand({
  description: "Creates an entry with the given name.",
  schema: z.object({ name: z.string().min(1) }),
  run: ({ name }) => saveEntry(NEW_ENTRY_ID, name),
});
