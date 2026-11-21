// The timer's actions with their Notices, once for every caller (#349): the Module Indicator, the
// Commands (#351) and the Indicator Panel (#350) each run an Operation through these functions.
// They take the Port access and notice seams the caller was given (D261), so code outside React
// calls them as a component does. The file loads with its first caller, never at startup, and
// loads none of the module's Views.

import { Plural, Trans } from "@lingui/react/macro";
import type { DataAccess } from "@self-engine/data-client/react";
import { notifyDone, notifyRefused, notifyUndoable } from "@self-engine/ui";
// Types only: the Contract's schemas never load with the indicator (startup check).
import type { TimerId, TimerStop, TimerUndo } from "./contracts/index.ts";
import { startTimer, stopTimer, undoStopTimer } from "./port.ts";

type StartInput = Parameters<typeof startTimer>[1];
type StartResult = Awaited<ReturnType<typeof startTimer>>;
type StopResult = Awaited<ReturnType<typeof stopTimer>>;

// Elements, not text: `Trans` translates when the Notice renders, in the language active then.
const SAVED = <Trans>Time entry saved</Trans>;
const NOTHING_SAVED = <Trans>Stopped within the same second: nothing was saved.</Trans>;
const CLOCK_BEFORE_START = (
  <Trans>The clock shows a time before the timer's start. The timer keeps running.</Trans>
);

/** Says what stopping the timers that ran before did: a start's and an undo's `others`. */
function tellOthers(others: readonly TimerStop[]) {
  let saved = 0;
  let clockBeforeStart = false;
  for (const other of others) {
    switch (other.kind) {
      case "saved":
        saved += 1;
        break;
      // Less than a second: nothing to tell of a timer that leaves nothing behind.
      case "discarded":
        break;
      case "clockBeforeStart":
        clockBeforeStart = true;
        break;
      default:
        other satisfies never;
    }
  }
  if (saved > 0) {
    notifyDone({
      message: (
        <Plural
          one="The running timer was stopped and its time entry saved."
          other="# running timers were stopped and their time entries saved."
          value={saved}
        />
      ),
    });
  }
  if (clockBeforeStart) notifyRefused({ reasons: [CLOCK_BEFORE_START] });
}

/** Says what an undo did. A second click on "Undo" finds the timer running and says nothing. */
function tellUndo(undo: TimerUndo) {
  switch (undo.kind) {
    case "restored":
      tellOthers(undo.others);
      return;
    case "alreadyRunning":
      return;
    default:
      undo satisfies never;
  }
}

/**
 * Stops the timer and tells what happened (D349): a saved entry with "Undo", which lets the timer
 * run again as one Operation; a stop within the same second saved nothing (D344); a clock before
 * the start leaves the timer running. Any other result the building block has told already.
 */
export async function stopTimerAndTell(data: DataAccess, id: TimerId): Promise<StopResult> {
  const result = await stopTimer(data, { id });
  if (result.status !== "success") return result;
  const stop = result.data;
  switch (stop.kind) {
    case "saved":
      notifyUndoable({
        message: SAVED,
        undo: async () => {
          const undone = await undoStopTimer(data, { id });
          if (undone.status === "success") tellUndo(undone.data);
        },
      });
      break;
    case "discarded":
      notifyDone({ message: NOTHING_SAVED });
      break;
    case "clockBeforeStart":
      notifyRefused({ reasons: [CLOCK_BEFORE_START] });
      break;
    default:
      stop satisfies never;
  }
  return result;
}

/**
 * Starts a timer and tells what stopping the one that ran before did (D349). The new timer shows
 * itself in the Module Indicator, so its start needs no Notice of its own.
 */
export async function startTimerAndTell(
  data: DataAccess,
  input: StartInput = {},
): Promise<StartResult> {
  const result = await startTimer(data, input);
  if (result.status === "success") tellOthers(result.data.others);
  return result;
}
