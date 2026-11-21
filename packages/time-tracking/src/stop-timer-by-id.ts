import { defineInputCommand } from "@self-engine/shell";
import { z } from "zod";
import { timerIdSchema } from "./contracts/ids.ts";
import { stopTimerAndTell } from "./timer-actions.tsx";

export default defineInputCommand({
  description:
    "Stops the timer with the given id. Returns the saved time entry, a same-second discard, or a clock-before-start result that leaves the timer running.",
  schema: z.strictObject({ id: timerIdSchema }),
  run: ({ id }, { data }) => stopTimerAndTell(data, id),
});
