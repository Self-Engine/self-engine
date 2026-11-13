import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { createSampleEntry } from "./port.ts";

export default defineOpenCommand({
  description: "Adds a sample entry. The name is optional.",
  schema: z.object({ name: z.string().min(1).default("Sample entry") }),
  // A taken name has no form to show it at: the building block shows it as a notice (D264).
  run: ({ name }, { data }) => createSampleEntry(data, { name }),
});
