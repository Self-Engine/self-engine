import { projectIdSchema } from "@self-engine/projects/ids";
import { defineInputCommand } from "@self-engine/shell";
import { z } from "zod";
import { noteSchema } from "./contracts/note.ts";
import { startTimerAndTell } from "./timer-actions.tsx";

export default defineInputCommand({
  description:
    "Starts a timer for the given project id, with an optional note. Stops any other running timers and returns the new timer and the other timers' stop results.",
  schema: z.strictObject({ projectId: projectIdSchema, note: noteSchema.optional() }),
  run: (input, { data }) => startTimerAndTell(data, input),
});
