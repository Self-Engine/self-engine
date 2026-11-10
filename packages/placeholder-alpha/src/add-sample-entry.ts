import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { saveEntry } from "./entry-store.ts";
import { NEW_ENTRY_ID } from "./sample-data.ts";

export default defineOpenCommand({
  description: "Adds a sample entry. The name is optional.",
  schema: z.object({ name: z.string().min(1).default("Sample entry") }),
  run: ({ name }) => saveEntry(NEW_ENTRY_ID, name),
});
