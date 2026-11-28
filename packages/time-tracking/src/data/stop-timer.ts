import type { TablesOf } from "@self-engine/db";
import {
  inputError,
  notFound,
  sharedEntry,
  sharedWrites,
  type StorageContext,
  type WriteTransaction,
} from "@self-engine/storage";
import { type Instant, wholeSecondOf } from "@self-engine/time";
import {
  END_BEFORE_START,
  END_IN_FUTURE,
  timeEntryIdOfTimer,
  type TimerId,
  type TimerStop,
} from "../contracts/index.ts";
import { storedProjects, writeProjectShares } from "./project-shares.ts";
import { roundedColumns, ruleThatHolds } from "./rounded-columns.ts";
import {
  TIMER_COLUMNS,
  type TimerValues,
  type timeTrackingRowMap,
  toTimeEntry,
  toTimer,
} from "./rows.ts";
import { runningTimers } from "./timers.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type Writes = WriteTransaction<Tables>;

/**
 * Stops one running Timer inside the caller's transaction, by the rules of D349: with an end given
 * ("Stop at …") it checks that end; without one the Data Process's "now" ends it, and a "now"
 * within the timer's second discards it while a "now" before its start writes nothing. Every
 * Operation that ends a timer goes through here: stop, the start that stops the others, and the
 * undos that bring one back.
 */
export async function stopRunningTimer(
  tx: Writes,
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
  tx: Writes,
  context: StorageContext,
  timer: TimerValues,
  end: Instant,
): Promise<TimerStop> {
  const writes = sharedWrites(tx, context);
  const id = timeEntryIdOfTimer(timer.id);
  // The zone of the Setting at the moment of stopping, read in the transaction (D342).
  const timeZone = await context.readTimeZone(tx);
  // The timer's project is the entry's only project, with the whole Booked Duration.
  const projects = timer.project_id === null ? [] : [{ projectId: timer.project_id, weight: 1 }];
  const { columns, projectShares } = roundedColumns({
    startedAt: timer.started_at,
    endedAt: end,
    timeZone,
    rule: await ruleThatHolds(tx, context, {
      projectId: timer.project_id,
      startedAt: timer.started_at,
    }),
    ruleChosenByHand: false,
    // A Timer records no breaks yet.
    breaks: [],
    projects,
  });
  const values = { ...columns, note: timer.note, time_zone: timeZone };
  const stored = await storedEntryOfTimer(tx, context, timer.id);
  // The first stop inserts the entry. After "undo stop", the entry of the earlier stop comes back
  // with the timer's note and the new end, Rounded Time, Booked Duration, rule and Time Zone, in
  // one write, so the timer keeps one entry (D349). "Undo stop" removed its projects, so it gets
  // the one the timer has now, and the reference check judges that one (D371).
  const row =
    stored === "none"
      ? await writes.insert("time_entries", id, values)
      : stored === "deleted"
        ? await writes.restore("time_entries", id, values)
        : await writes.update("time_entries", id, values);
  const before = stored === "none" ? [] : (await storedProjects(tx, context, id)).rows;
  const shares = await writeProjectShares(tx, context, id, projects, projectShares, before);
  await writes.softDelete("timers", timer.id);
  return { kind: "saved", entry: toTimeEntry(row, shares) };
}

/**
 * Whether the Time Entry of a timer's id is stored, and as a Live Row or a deleted one: one
 * lookup by primary key in the call's Space, which also sees the deleted row an "undo stop" left.
 */
export async function storedEntryOfTimer(
  tx: Writes,
  context: StorageContext,
  id: TimerId,
): Promise<"live" | "deleted" | "none"> {
  const row = await tx
    .selectFrom("time_entries")
    .select("deleted_at")
    .where("id", "=", timeEntryIdOfTimer(id))
    .where("space_id", "=", context.spaceId)
    .executeTakeFirst();
  if (row === undefined) return "none";
  return row.deleted_at === null ? "live" : "deleted";
}

/**
 * The timer with the id in the call's Space, running or not: one lookup by primary key. Not found
 * when no timer of that id was ever stored.
 */
export async function storedTimer(tx: Writes, context: StorageContext, id: TimerId) {
  const timer = await tx
    .selectFrom("timers")
    .select([...TIMER_COLUMNS, "timers.deleted_at"])
    .where("timers.id", "=", id)
    .where("timers.space_id", "=", context.spaceId)
    .executeTakeFirst();
  if (timer === undefined) throw notFound();
  return timer;
}

/**
 * The stop Operation: the running timer with the id, or, once a stop has saved its entry, that
 * entry again without a write (D349). A discarded or unknown timer is not found, and so is the id
 * of a Time Entry made by hand: only a timer that was stored has an entry of its id to answer.
 */
export async function stopTimer(
  tx: Writes,
  context: StorageContext,
  input: { readonly id: TimerId; readonly endedAt?: Instant | undefined },
): Promise<TimerStop> {
  const timer = await storedTimer(tx, context, input.id);
  if (timer.deleted_at === null) return stopRunningTimer(tx, context, timer, input.endedAt);
  // Not found without a live entry of the timer's id: the timer was discarded.
  const id = timeEntryIdOfTimer(input.id);
  const entry = await sharedEntry(tx, context).lookup("time_entries", id);
  return {
    kind: "saved",
    entry: toTimeEntry(entry, (await storedProjects(tx, context, id)).shares),
  };
}

/**
 * Stops every running timer before another one runs (D349): one timer at a time is a flow of the
 * Operation, not a rule (D310). Answers what each stop did, the most recently started first; a
 * timer whose start lies after "now" keeps running.
 */
export async function stopRunningTimers(tx: Writes, context: StorageContext): Promise<TimerStop[]> {
  const running = await runningTimers(tx, context).execute();
  const stops: TimerStop[] = [];
  for (const timer of running) stops.push(await stopRunningTimer(tx, context, timer));
  return stops;
}
