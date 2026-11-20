import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { indicator } from "./indicator-entry.ts";

export default defineOpenCommand({
  description: "Opens the panel of the module's indicator, where a note becomes a new entry.",
  schema: z.object({}),
  run: (_input, { openIndicatorPanel }) => openIndicatorPanel(indicator),
});
