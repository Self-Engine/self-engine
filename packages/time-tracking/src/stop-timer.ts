import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { readLatestRunningTimer } from "./port.ts";
import { timerFormThrough } from "./open-timer-form.ts";
import { NO_TIMER_RUNNING, stopTimerAndTell } from "./timer-actions.tsx";

export default defineOpenCommand({
  description:
    "Stops the most recently started running timer. Returns its stop result, or null if no timer runs.",
  schema: z.strictObject({}),
  async run(_input, { data, openIndicatorPanel }) {
    const timer = await readLatestRunningTimer(data);
    if (timer === undefined) {
      // Through the building block's seam: a person reads it, a caller without a screen gets the
      // value `null` and a seam that shows nothing.
      data.notify(NO_TIMER_RUNNING);
      return null;
    }
    return stopTimerAndTell(data, timer.id, { openForm: timerFormThrough(openIndicatorPanel) });
  },
});
