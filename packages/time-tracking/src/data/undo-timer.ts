import type { TablesOf } from "@self-engine/db";
import {
  notFound,
  sharedWrites,
  type StorageContext,
  type WriteTransaction,
} from "@self-engine/storage";
import { timeEntryIdOfTimer, type TimerId, type TimerUndo } from "../contracts/index.ts";
import { type timeTrackingRowMap, toTimer } from "./rows.ts";
import { storedProjects } from "./project-shares.ts";
import { stopRunningTimers, storedEntryOfTimer, storedTimer } from "./stop-timer.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type Writes = WriteTransaction<Tables>;

/**
 * Brings a stopped or discarded timer back (D349): every other running timer stops first, by the
 * rules of stop, then the frame restores the timer. Its reference check refuses the restore when
 * the timer's project was deleted meanwhile, and the Refusal rolls the whole transaction back.
 */
async function resume(tx: Writes, context: StorageContext, id: TimerId): Promise<TimerUndo> {
  const others = await stopRunningTimers(tx, context);
  const timer = toTimer(await sharedWrites(tx, context).restore("timers", id));
  return { kind: "restored", timer, others };
}

/**
 * "Undo stop", one Operation over both tables (D349): the timer's entry is soft-deleted as it is,
 * also after an edit, and the timer runs again with its own start, project and note. Its projects
 * are removed from it first, while it lives, so the stop that saves it again gives it the project
 * the timer has then, though the earlier one was deleted meanwhile (D371): a restore is judged with
 * the entry's live shares. This is the one exception ADR 0042 names: an entry taken back this way
 * and restored by another route comes back without projects. A timer that runs again writes
 * nothing; one without a live entry of its id is not found.
 */
export async function undoStopTimer(
  tx: Writes,
  context: StorageContext,
  input: { readonly id: TimerId },
): Promise<TimerUndo> {
  const timer = await storedTimer(tx, context, input.id);
  if (timer.deleted_at === null) return { kind: "alreadyRunning", timer: toTimer(timer) };
  // Not found unless a stop saved the entry and it still lives: nothing is written before.
  const id = timeEntryIdOfTimer(input.id);
  const writes = sharedWrites(tx, context);
  const { rows } = await storedProjects(tx, context, id);
  await writes.lookup("time_entries", id);
  for (const share of rows) await writes.softDelete("project_shares", share.id);
  await writes.softDelete("time_entries", id);
  return resume(tx, context, input.id);
}

/**
 * "Undo discard" (D349): the timer runs again with its own start, project and note. A timer that
 * runs again writes nothing; a stopped one, whose entry lives, is not found.
 */
export async function undoDiscardTimer(
  tx: Writes,
  context: StorageContext,
  input: { readonly id: TimerId },
): Promise<TimerUndo> {
  const timer = await storedTimer(tx, context, input.id);
  if (timer.deleted_at === null) return { kind: "alreadyRunning", timer: toTimer(timer) };
  if ((await storedEntryOfTimer(tx, context, input.id)) === "live") throw notFound();
  return resume(tx, context, input.id);
}
