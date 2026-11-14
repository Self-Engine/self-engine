import { definePageCommand } from "@self-engine/shell";
import { z } from "zod";
import { openNewProject } from "./project-address.ts";

export default definePageCommand({
  description: "Opens the edit drawer for a new project on the current page.",
  schema: z.strictObject({}),
  run: (_input, { writeSearch }) => openNewProject(writeSearch),
});
