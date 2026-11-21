import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { readLatestRunningTimer } from "./port.ts";
import { startTimerAndTell, stopTimerAndTell } from "./timer-actions.tsx";

export default defineOpenCommand({
  description:
    "Starts a timer without a project or note when none runs. Otherwise stops the most recently started timer. Returns the result of the operation it ran.",
  schema: z.strictObject({}),
  async run(_input, { data, openIndicatorPanel }) {
    const timer = await readLatestRunningTimer(data);
    return timer === undefined
      ? startTimerAndTell(data, {}, { openIndicatorPanel })
      : stopTimerAndTell(data, timer.id, { openIndicatorPanel });
  },
});
