import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { notifyConflict } from "./notices.tsx";
import { createEntry } from "./port.ts";

export default defineOpenCommand({
  description: "Adds a sample entry. The name is optional.",
  schema: z.object({ name: z.string().min(1).default("Sample entry") }),
  run: async ({ name }, { data }) => {
    const result = await createEntry(data, { name });
    // No form to show it at: a taken name becomes a notice.
    if (result.status === "conflict") notifyConflict(result.text);
    return result;
  },
});
