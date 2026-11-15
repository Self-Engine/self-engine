import { defineInputCommand } from "@self-engine/shell";
import { projectFields } from "./contracts/index.ts";
import { createProject } from "./port.ts";

// The Command checks with the input schema of the Contract, so a wrong or unknown field is
// answered as the input error with its field before any call. It loads only when it runs.
export default defineInputCommand({
  description:
    "Creates a project. Only the title is required; description, icon (an icon name or one emoji) and color (a color set name) are optional. Answers with the project, or with the input error and its field.",
  schema: projectFields.create,
  run: (input, { data }) => createProject(data, input),
});
