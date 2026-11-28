import { createMigrationRunner } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { projectIdSchema } from "@self-engine/projects/contracts";
import { projects } from "@self-engine/projects/data";
import { checkContract } from "@self-engine/storage/testing";
import { instantSchema } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import { roundingRuleIdSchema, timeEntryIdSchema, timerIdSchema } from "../contracts/index.ts";
import { timeTracking } from "./index.ts";
import { timeTrackingMigrations, timeTrackingRowMap } from "./rows.ts";

/** The `n`th deterministic id of the contract kit's seed. */
const seedId = (n: number) => `01a1cfa1-0a00-7000-8000-${String(n).padStart(12, "0")}`;
// The seed creates the project first, then its time entry.
const projectId = projectIdSchema.parse(seedId(0));
const entryId = timeEntryIdSchema.parse(seedId(1));
const deletedEntryId = timeEntryIdSchema.parse(seedId(2));
// Then a discarded timer, a stopped one with its entry of the same id, and a running one.
const discardedTimerId = timerIdSchema.parse(seedId(3));
const stoppedTimerId = timerIdSchema.parse(seedId(4));
const timerId = timerIdSchema.parse(seedId(5));
const instant = (text: string) => instantSchema.parse(text);

test("the time entries, timers and rounding rules tables follow the conventions and agrees with its row map", async () => {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, [
      ...projects.migrations,
      ...timeTrackingMigrations,
    ]).run();
    await expect(checkConventions(database)).resolves.toEqual([]);
    await expect(checkAgreement(timeTrackingMigrations, timeTrackingRowMap)).resolves.toEqual([]);
  } finally {
    await database.close();
  }
});

test("time-tracking passes the storage contract kit with `projects` below it", async () => {
  await expect(
    checkContract(
      timeTracking,
      async (tx, context) => {
        const website = await projects.entries.create.run(tx.withTables(), context, {
          title: "Website",
        });
        const range = {
          startedAt: instant("2026-11-16T09:00:00.000Z"),
          endedAt: instant("2026-11-16T10:30:00.000Z"),
          projectId: website.id,
        };
        const { entries } = timeTracking;
        await entries.create.run(tx, context, { ...range, note: "Design" });
        const deleted = await entries.create.run(tx, context, { ...range, note: "Old design" });
        await entries.delete.run(tx, context, { id: deleted.id });
        const { timer: discarded } = await entries.startTimer.run(tx, context, {});
        await entries.discardTimer.run(tx, context, { id: discarded.id });
        const { timer: stopped } = await entries.startTimer.run(tx, context, { note: "Mail" });
        await entries.editTimer.run(tx, context, {
          id: stopped.id,
          startedAt: instant("2026-11-11T09:00:00.000Z"),
        });
        await entries.stopTimer.run(tx, context, {
          id: stopped.id,
          endedAt: instant("2026-11-11T10:00:00.000Z"),
        });
        const { timer } = await entries.startTimer.run(tx, context, {
          projectId: website.id,
          note: "Design",
        });
        // Before the kit's clock, so that stop and start save its entry.
        await entries.editTimer.run(tx, context, {
          id: timer.id,
          startedAt: instant("2026-11-12T09:00:00.000Z"),
        });
        // A rule of the project, a Part Row of it, and the app-wide rule, which names none. No
        // Operation writes a rule yet (#422); their ids come after the counted ones above.
        const rule = (project_id: typeof website.id | null) => ({
          id: context.newId(roundingRuleIdSchema),
          created_at: context.now,
          updated_at: context.now,
          deleted_at: null,
          space_id: context.spaceId,
          project_id,
          holds_from: null,
          rounding_rule: '{"kind":"ordinary","direction":"up","minutes":15}',
        });
        await tx
          .insertInto("rounding_rules")
          .values([rule(website.id), rule(null)])
          .execute();
      },
      {
        create: {
          startedAt: "2026-11-16T11:00:00.250Z",
          endedAt: "2026-11-16T12:00:00.750Z",
          projectId,
          note: "Build",
          ruleByHand: { kind: "exact" },
          breaks: [
            {
              timeKind: "rest_break",
              startedAt: "2026-11-16T11:20:00.000Z",
              endedAt: "2026-11-16T11:40:00.000Z",
              changedByLimit: false,
            },
          ],
        },
        edit: {
          id: entryId,
          startedAt: "2026-11-16T11:00:00.000Z",
          endedAt: "2026-11-16T12:00:00.000Z",
          projectId,
          note: "Review",
          ruleByHand: { kind: "ordinary", direction: "up", minutes: 15 },
          breaks: [
            {
              timeKind: "rest_break",
              startedAt: "2026-11-16T11:20:00.000Z",
              endedAt: "2026-11-16T11:40:00.000Z",
              changedByLimit: false,
            },
          ],
        },
        move: { id: entryId, startedAt: "2026-11-16T08:00:00.000Z" },
        delete: { id: entryId },
        restore: { id: deletedEntryId },
        entry: { id: entryId },
        days: { span: { first: "2026-11-16", last: "2026-11-22" } },
        startTimer: { projectId, note: "Build" },
        // Before the kit's clock: a start in the future is an input error.
        editTimer: {
          id: timerId,
          startedAt: "2026-11-12T11:00:00.000Z",
          projectId,
          note: "Review",
        },
        stopTimer: { id: timerId },
        discardTimer: { id: timerId },
        undoStopTimer: { id: stoppedTimerId },
        undoDiscardTimer: { id: discardedTimerId },
        runningTimers: undefined,
      },
      {},
      [projects],
    ),
  ).resolves.toEqual([]);
});
