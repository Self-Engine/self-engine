import { definePageCommand } from "@self-engine/shell";
import { z } from "zod";
import { openNewTimeEntry } from "./entry-address.ts";

export default definePageCommand({
  description: "Opens the edit drawer for a new time entry on today, on the current page.",
  schema: z.strictObject({}),
  run: (_input, { writeSearch }) => openNewTimeEntry(writeSearch),
});
