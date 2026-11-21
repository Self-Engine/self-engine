import { ORPCError } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { inputError, sharedEntry, sharedWrites, type StorageContext } from "@self-engine/storage";
import { type Instant, wholeSecondOf } from "@self-engine/time";
import type { Transaction } from "kysely";
import {
  END_BEFORE_START,
  END_IN_FUTURE,
  timeEntryIdOfTimer,
  type TimerId,
  type TimerStop,
} from "../contracts/index.ts";
import {
  storedTimes,
  TIME_ENTRY_COLUMNS,
  TIMER_COLUMNS,
  type TimerValues,
  type timeTrackingRowMap,
  toTimeEntry,
  toTimer,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type WriteTransaction = Transaction<Tables>;

/**
 * Stops one running Timer inside the caller's transaction, by the rules of D349: with an end given
 * ("Stop at …") it checks that end; without one the Data Process's "now" ends it, and a "now"
 * within the timer's second discards it while a "now" before its start writes nothing. Every
 * Operation that ends a timer goes through here: stop, the start that stops the others, and the
 * undos that bring one back.
 */
export async function stopRunningTimer(
  tx: WriteTransaction,
  context: StorageContext,
  timer: TimerValues,
  endedAt?: Instant,
): Promise<TimerStop> {
  // Instants of the supported years compare as text in time order.
  const now = wholeSecondOf(context.now);
  if (endedAt !== undefined) {
    const end = wholeSecondOf(endedAt);
    const reason = end > now ? END_IN_FUTURE : end <= timer.started_at ? END_BEFORE_START : null;
    if (reason !== null) throw inputError(["endedAt"], reason);
    return saveEntry(tx, context, timer, end);
  }
  if (now < timer.started_at) return { kind: "clockBeforeStart", timer: toTimer(timer) };
  if (now === timer.started_at) {
    await sharedWrites(tx, context).softDelete("timers", timer.id);
    return { kind: "discarded", timer: toTimer(timer) };
  }
  return saveEntry(tx, context, timer, now);
}

async function saveEntry(
  tx: WriteTransaction,
  context: StorageContext,
  timer: TimerValues,
  end: Instant,
): Promise<TimerStop> {
  const writes = sharedWrites(tx, context);
  const row = await writes.insert("time_entries", timeEntryIdOfTimer(timer.id), {
    ...storedTimes(timer.started_at, end),
    project_id: timer.project_id,
    note: timer.note,
    // The zone of the Setting at the moment of stopping, read in the transaction (D342).
    time_zone: await context.readTimeZone(tx),
  });
  await writes.softDelete("timers", timer.id);
  return { kind: "saved", entry: toTimeEntry(row) };
}

/**
 * The stop Operation: the running timer with the id, or, once a stop has saved its entry, that
 * entry again without a write (D349). A discarded or unknown timer is not found.
 */
export async function stopTimer(
  tx: WriteTransaction,
  context: StorageContext,
  input: { readonly id: TimerId; readonly endedAt?: Instant | undefined },
): Promise<TimerStop> {
  const reads = sharedEntry(tx, context);
  const timer = await reads
    .live("timers")
    .where("timers.id", "=", input.id)
    .select(TIMER_COLUMNS)
    .executeTakeFirst();
  if (timer !== undefined) return stopRunningTimer(tx, context, timer, input.endedAt);
  const entry = await reads
    .live("time_entries")
    .where("time_entries.id", "=", timeEntryIdOfTimer(input.id))
    .select(TIME_ENTRY_COLUMNS)
    .executeTakeFirst();
  if (entry === undefined) throw new ORPCError("NOT_FOUND");
  return { kind: "saved", entry: toTimeEntry(entry) };
}

/**
 * Stops every running timer before another one runs (D349): one timer at a time is a flow of the
 * Operation, not a rule (D310). Answers what each stop did, the most recently started first; a
 * timer whose start lies after "now" keeps running.
 */
export async function stopRunningTimers(
  tx: WriteTransaction,
  context: StorageContext,
): Promise<TimerStop[]> {
  const running = await sharedEntry(tx, context)
    .live("timers")
    .select(TIMER_COLUMNS)
    .orderBy("timers.started_at", "desc")
    .orderBy("timers.id", "desc")
    .execute();
  const stops: TimerStop[] = [];
  for (const timer of running) stops.push(await stopRunningTimer(tx, context, timer));
  return stops;
}
