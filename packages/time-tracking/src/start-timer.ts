import { defineOpenCommand } from "@self-engine/shell";
import { z } from "zod";
import { timerFormThrough } from "./open-timer-form.ts";
import { startTimerAndTell } from "./timer-actions.tsx";

export default defineOpenCommand({
  description:
    "Starts a timer without a project or note. Stops any other running timers and returns the new timer and the other timers' stop results.",
  schema: z.strictObject({}),
  run: (_input, { data, openIndicatorPanel }) =>
    startTimerAndTell(data, {}, { openForm: timerFormThrough(openIndicatorPanel) }),
});
