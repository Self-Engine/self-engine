import { undoLatest } from "@self-engine/ui";
import { z } from "zod";
import { defineOpenCommand } from "./commands.ts";

export default defineOpenCommand({
  description:
    "Takes back the most recent action that still shows an undo offer. Does nothing when no offer is on screen.",
  schema: z.object({}),
  run: () => undoLatest(),
});
