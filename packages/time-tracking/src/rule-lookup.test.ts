// The Rounding Rule an entry gets when no rule is chosen by hand, through the Port of the test Data
// Process (ADR 0044): the rule of its project that held at its measured start, else the app-wide
// rule that held, else the default built into the code. No Operation writes a rule yet (#422), so
// the tests seed the rows as another device or a later version would.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { DEFAULT_ROUNDING_RULE, type RoundingRule } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

const EXACT: RoundingRule = { kind: "exact" };
const UP_15: RoundingRule = { kind: "ordinary", direction: "up", minutes: 15 };
const DOWN_5: RoundingRule = { kind: "ordinary", direction: "down", minutes: 5 };
const BLOCK_30: RoundingRule = { kind: "block", minutes: 30 };

/** A seeded rule: its project or none for the app-wide rule, and its "holds from" or none. */
interface SeededRule {
  readonly project: string | null;
  readonly holdsFrom: string | null;
  readonly rule: RoundingRule;
  /** When it was changed last; the seed's own Instant when not given. */
  readonly changedAt?: string;
  /** Its id; the seed counts them up when not given. */
  readonly id?: string;
}

let seededIds = 0;
const ruleId = (n: number) => `01a1cfa1-0e00-7000-8000-${String(n).padStart(12, "0")}`;

/**
 * The test Data Process with `projects`, `time-tracking` and `settings` on 20 April 2026, and
 * every statement that reads the table of Rounding Rules recorded.
 */
async function start() {
  const raw = openDatabase(":memory:");
  const ruleReads: string[] = [];
  const kysely = raw.kysely.withPlugin({
    transformQuery({ node, queryId }) {
      const { sql } = raw.kysely.getExecutor().compileQuery(node, queryId);
      if (/\brounding_rules\b/.test(sql) && /^\s*select/i.test(sql)) ruleReads.push(sql);
      return node;
    },
    transformResult: async ({ result }) => result,
  });
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    database: { ...raw, kysely },
    sources: createTestSources("2026-04-20T10:00:00.000Z"),
  });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      ProtocolContract & {
        projects: typeof projects.contract;
        timeTracking: typeof timeTracking.contract;
        settings: typeof settings.contract;
      }
    >
  >(new RPCLink({ port: process.openPort() }));

  /** Writes rows of Rounding Rules directly: no Operation of this version writes one. */
  async function seedRules(...rules: SeededRule[]) {
    for (const { project, holdsFrom, rule, changedAt, id } of rules) {
      const changed = changedAt ?? "2026-01-01T00:00:00.000Z";
      await raw.kysely
        .withTables<{
          rounding_rules: {
            id: string;
            created_at: string;
            updated_at: string;
            deleted_at: string | null;
            space_id: string;
            project_id: string | null;
            holds_from: string | null;
            rounding_rule: string;
          };
          spaces: { id: string };
        }>()
        .insertInto("rounding_rules")
        .values((eb) => ({
          id: id ?? ruleId(++seededIds),
          created_at: changed,
          updated_at: changed,
          deleted_at: null,
          space_id: eb.selectFrom("spaces").select("id").limit(1),
          project_id: project,
          holds_from: holdsFrom,
          rounding_rule: JSON.stringify(rule),
        }))
        .execute();
    }
  }
  return { client, seedRules, ruleReads };
}

const entryAt = (start: string, end: string) => ({
  startedAt: `${start}.000Z`,
  endedAt: `${end}.000Z`,
});

describe("on create, the entry's project", () => {
  test("gives the rule with the latest 'holds from' at or before the measured start", async () => {
    const { client, seedRules } = await start();
    const website = await client.projects.create({ title: "Website" });
    await seedRules(
      { project: website.id, holdsFrom: null, rule: EXACT },
      { project: website.id, holdsFrom: "2026-04-01T08:00:00.000Z", rule: UP_15 },
      { project: website.id, holdsFrom: "2026-04-10T08:00:00.000Z", rule: DOWN_5 },
      // Later than every entry below: it holds for none of them.
      { project: website.id, holdsFrom: "2026-05-01T00:00:00.000Z", rule: BLOCK_30 },
      { project: null, holdsFrom: null, rule: BLOCK_30 },
    );
    const create = (start: string, end: string) =>
      client.timeTracking.create({ ...entryAt(start, end), projectId: website.id });

    // A rule without "holds from" holds from the beginning.
    await expect(create("2026-03-02T09:00:00", "2026-03-02T09:10:00")).resolves.toMatchObject({
      roundingRule: EXACT,
      ruleByHand: null,
    });
    // At the Instant itself the rule holds.
    await expect(create("2026-04-01T08:00:00", "2026-04-01T09:00:00")).resolves.toMatchObject({
      roundingRule: UP_15,
    });
    await expect(create("2026-04-01T07:59:59", "2026-04-01T09:00:00")).resolves.toMatchObject({
      roundingRule: EXACT,
    });
    await expect(create("2026-04-15T09:00:00", "2026-04-15T10:00:00")).resolves.toMatchObject({
      roundingRule: DOWN_5,
    });
  });

  test("without a rule of its own that held, gives the app-wide rule that held, else the default", async () => {
    const { client, seedRules } = await start();
    const [website, shop] = [
      await client.projects.create({ title: "Website" }),
      await client.projects.create({ title: "Shop" }),
    ];
    await seedRules(
      { project: website.id, holdsFrom: "2026-04-10T00:00:00.000Z", rule: EXACT },
      { project: null, holdsFrom: "2026-04-01T00:00:00.000Z", rule: UP_15 },
    );
    const create = (projectId: string, start: string) =>
      client.timeTracking.create({
        ...entryAt(start, "2026-04-15T12:00:00"),
        projectId: projectId as typeof website.id,
      });

    await expect(create(website.id, "2026-04-05T09:00:00")).resolves.toMatchObject({
      roundingRule: UP_15,
    });
    await expect(create(shop.id, "2026-04-05T09:00:00")).resolves.toMatchObject({
      roundingRule: UP_15,
    });
    await expect(create(shop.id, "2026-03-30T09:00:00")).resolves.toMatchObject({
      roundingRule: DEFAULT_ROUNDING_RULE,
    });
  });

  test("an entry without a project takes the app-wide rule, never a project's", async () => {
    const { client, seedRules } = await start();
    const website = await client.projects.create({ title: "Website" });
    await seedRules(
      { project: website.id, holdsFrom: null, rule: EXACT },
      { project: null, holdsFrom: null, rule: UP_15 },
    );

    await expect(
      client.timeTracking.create(entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00")),
    ).resolves.toMatchObject({ roundingRule: UP_15 });
  });

  test("a rule chosen by hand stays the entry's rule", async () => {
    const { client, seedRules } = await start();
    await seedRules({ project: null, holdsFrom: null, rule: UP_15 });

    await expect(
      client.timeTracking.create({
        ...entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00"),
        ruleByHand: EXACT,
      }),
    ).resolves.toMatchObject({ roundingRule: EXACT, ruleByHand: EXACT });
  });
});

test("a forgotten entry of 28 March, entered on 20 April, gets the rule that held on 28 March", async () => {
  const { client, seedRules } = await start();
  const website = await client.projects.create({ title: "Website" });
  await seedRules(
    { project: website.id, holdsFrom: null, rule: UP_15 },
    // Changed on 1 April "from now", after the entry and before it was entered.
    { project: website.id, holdsFrom: "2026-04-01T07:30:00.000Z", rule: EXACT },
  );

  await expect(
    client.timeTracking.create({
      startedAt: "2026-03-28T09:07:30.000Z",
      endedAt: "2026-03-28T09:29:50.000Z",
      projectId: website.id,
    }),
  ).resolves.toMatchObject({
    roundingRule: UP_15,
    roundedTime: { start: "2026-03-28T09:07:00.000Z", end: "2026-03-28T09:37:00.000Z" },
    bookedDuration: 30 * 60,
  });
});

describe("of two rules with the same 'holds from'", () => {
  test("the one changed last holds, then the one with the larger id", async () => {
    const { client, seedRules } = await start();
    const website = await client.projects.create({ title: "Website" });
    const from = "2026-04-01T00:00:00.000Z";
    await seedRules(
      { project: website.id, holdsFrom: from, rule: EXACT, changedAt: "2026-04-02T00:00:00.000Z" },
      { project: website.id, holdsFrom: from, rule: UP_15, changedAt: "2026-04-03T00:00:00.000Z" },
      { project: website.id, holdsFrom: from, rule: DOWN_5, changedAt: "2026-04-01T00:00:00.000Z" },
    );
    await expect(
      client.timeTracking.create({
        ...entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00"),
        projectId: website.id,
      }),
    ).resolves.toMatchObject({ roundingRule: UP_15 });
  });

  test("of two first rules changed at once, the one with the larger id holds", async () => {
    const { client, seedRules } = await start();
    const website = await client.projects.create({ title: "Website" });
    const changedAt = "2026-04-02T00:00:00.000Z";
    await seedRules(
      { project: website.id, holdsFrom: null, rule: DOWN_5, changedAt, id: ruleId(900) },
      { project: website.id, holdsFrom: null, rule: EXACT, changedAt, id: ruleId(901) },
      { project: website.id, holdsFrom: null, rule: UP_15, changedAt, id: ruleId(899) },
    );
    await expect(
      client.timeTracking.create({
        ...entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00"),
        projectId: website.id,
      }),
    ).resolves.toMatchObject({ roundingRule: EXACT });
  });
});

describe("an edit", () => {
  test("of start or end keeps the entry's own rule, also when the start moves past a 'holds from'", async () => {
    const { client, seedRules } = await start();
    const website = await client.projects.create({ title: "Website" });
    await seedRules(
      { project: website.id, holdsFrom: null, rule: UP_15 },
      { project: website.id, holdsFrom: "2026-04-10T00:00:00.000Z", rule: EXACT },
    );
    const created = await client.timeTracking.create({
      ...entryAt("2026-04-05T09:00:00", "2026-04-05T09:20:00"),
      projectId: website.id,
    });
    expect(created).toMatchObject({ roundingRule: UP_15 });

    await expect(
      client.timeTracking.edit({
        id: created.id,
        ...entryAt("2026-04-15T09:00:00", "2026-04-15T09:20:00"),
      }),
    ).resolves.toMatchObject({ roundingRule: UP_15, ruleByHand: null, bookedDuration: 30 * 60 });
  });

  test("'look up again' takes the rule that holds for the edited project at the edited start", async () => {
    const { client, seedRules } = await start();
    const [website, shop] = [
      await client.projects.create({ title: "Website" }),
      await client.projects.create({ title: "Shop" }),
    ];
    await seedRules(
      { project: website.id, holdsFrom: null, rule: UP_15 },
      { project: shop.id, holdsFrom: "2026-04-10T00:00:00.000Z", rule: EXACT },
    );
    const created = await client.timeTracking.create({
      ...entryAt("2026-04-05T09:00:00", "2026-04-05T09:20:00"),
      projectId: website.id,
      ruleByHand: DOWN_5,
    });

    await expect(
      client.timeTracking.edit({
        id: created.id,
        ...entryAt("2026-04-15T09:00:00", "2026-04-15T09:20:00"),
        projectId: shop.id,
        ruleByHand: null,
      }),
    ).resolves.toMatchObject({ roundingRule: EXACT, ruleByHand: null });
  });
});

test("the Timer's stop takes the rule of its project that held at its start", async () => {
  const { client, seedRules } = await start();
  const website = await client.projects.create({ title: "Website" });
  await seedRules(
    { project: website.id, holdsFrom: null, rule: EXACT },
    { project: website.id, holdsFrom: "2026-04-20T09:30:00.000Z", rule: UP_15 },
  );
  const { timer } = await client.timeTracking.startTimer({ projectId: website.id });
  await client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-04-20T09:20:00.000Z" });

  await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toMatchObject({
    kind: "saved",
    entry: { roundingRule: EXACT, ruleByHand: null },
  });
});

test("a project's rules belong to it: it is deleted without live entries, and its rules hold again once it is restored", async () => {
  const { client, seedRules } = await start();
  const website = await client.projects.create({ title: "Website" });
  await seedRules(
    { project: website.id, holdsFrom: null, rule: EXACT },
    { project: null, holdsFrom: null, rule: UP_15 },
  );
  const entry = await client.timeTracking.create({
    ...entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00"),
    projectId: website.id,
  });
  await client.timeTracking.delete({ id: entry.id });

  await expect(client.projects.delete({ id: website.id })).resolves.toMatchObject({
    id: website.id,
  });
  await client.projects.restore({ id: website.id });

  await expect(
    client.timeTracking.create({
      ...entryAt("2026-04-16T09:00:00", "2026-04-16T10:00:00"),
      projectId: website.id,
    }),
  ).resolves.toMatchObject({ roundingRule: EXACT });
});

test("the lookup is one read per write: create, stop and 'look up again'", async () => {
  const { client, seedRules, ruleReads } = await start();
  const website = await client.projects.create({ title: "Website" });
  await seedRules({ project: website.id, holdsFrom: null, rule: EXACT });
  const reads = async (write: () => Promise<unknown>) => {
    ruleReads.length = 0;
    await write();
    return ruleReads.length;
  };

  const created = await client.timeTracking.create({
    ...entryAt("2026-04-15T09:00:00", "2026-04-15T10:00:00"),
    projectId: website.id,
  });
  ruleReads.length = 0;
  await expect(
    reads(() =>
      client.timeTracking.create({
        ...entryAt("2026-04-15T11:00:00", "2026-04-15T12:00:00"),
        projectId: website.id,
      }),
    ),
  ).resolves.toBe(1);
  await expect(
    reads(() => client.timeTracking.edit({ id: created.id, ruleByHand: null })),
  ).resolves.toBe(1);
  // An edit that keeps the entry's own rule looks nothing up.
  await expect(
    reads(() => client.timeTracking.edit({ id: created.id, note: "Review" })),
  ).resolves.toBe(0);
  const { timer } = await client.timeTracking.startTimer({ projectId: website.id });
  await client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-04-20T09:00:00.000Z" });
  await expect(reads(() => client.timeTracking.stopTimer({ id: timer.id }))).resolves.toBe(1);
});
