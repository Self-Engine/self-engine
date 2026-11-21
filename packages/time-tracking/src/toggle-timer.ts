import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { readLatestRunningTimer } from "./port.ts";
import { stopAtThrough } from "./stop-at.ts";
import { startTimerAndTell, stopTimerAndTell } from "./timer-actions.tsx";

export default defineOpenCommand({
  description:
    "Starts a timer without a project or note when none runs. Otherwise stops the most recently started timer. Returns the result of the operation it ran.",
  schema: z.strictObject({}),
  async run(_input, { data, openIndicatorPanel }) {
    const timer = await readLatestRunningTimer(data);
    const actions = { openStopAt: stopAtThrough(openIndicatorPanel) };
    return timer === undefined
      ? startTimerAndTell(data, {}, actions)
      : stopTimerAndTell(data, timer.id, actions);
  },
});
