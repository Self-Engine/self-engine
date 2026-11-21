import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { readLatestRunningTimer } from "./port.ts";
import { stopAtThrough } from "./stop-at.ts";
import { stopTimerAndTell } from "./timer-actions.tsx";

export default defineOpenCommand({
  description:
    "Stops the most recently started running timer. Returns its stop result, or null if no timer runs.",
  schema: z.strictObject({}),
  async run(_input, { data, openIndicatorPanel }) {
    const timer = await readLatestRunningTimer(data);
    return timer === undefined
      ? null
      : stopTimerAndTell(data, timer.id, { openStopAt: stopAtThrough(openIndicatorPanel) });
  },
});
