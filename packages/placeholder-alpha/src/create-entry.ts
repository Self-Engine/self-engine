import { definePageCommand } from "@self-engine/shell";
import { z } from "zod";
import { NEW_ENTRY_ID } from "./entry-address.ts";

export default definePageCommand({
  description: "Opens the edit drawer for a new entry on the current page.",
  schema: z.object({}),
  run: (_input, { writeSearch }) => writeSearch((search) => ({ ...search, edit: NEW_ENTRY_ID })),
});
