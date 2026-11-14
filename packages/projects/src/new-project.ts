import { definePageCommand } from "@self-engine/shell";
import { z } from "zod";
import { NEW_PROJECT_ID } from "./project-address.ts";

export default definePageCommand({
  description: "Opens the edit drawer for a new project on the current page.",
  schema: z.object({}),
  run: (_input, { writeSearch }) => writeSearch((search) => ({ ...search, edit: NEW_PROJECT_ID })),
});
