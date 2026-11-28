// Run through measure-time-tracking.test.ts so the module's SQL imports are transformed by Vite.
import { createRouterClient } from "@orpc/server";
import type { Database } from "@self-engine/db";
import { projects } from "@self-engine/projects/data";
import { createFrame } from "@self-engine/storage";
import { createTestContext, createTestDatabase, queryPlan } from "@self-engine/storage/testing";
import { timeTracking } from "@self-engine/time-tracking/data";
import { type CompiledQuery, sql } from "kysely";

const FIRST_DAY = Date.parse("2024-11-23T00:00:00Z");
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const ENTRY_COUNT = 8_030;

export const SPANS = {
  recent: { first: "2026-11-16", last: "2026-11-22" },
  old: { first: "2024-11-25", last: "2024-12-01" },
  sixWeeks: { first: "2026-10-12", last: "2026-11-22" },
};

const START_INDEX = "time_entries_started";
const END_INDEX = "time_entries_ended";
export const INDEXES = {
  both: [START_INDEX, END_INDEX],
  start: [START_INDEX],
  end: [END_INDEX],
} as const;

export async function setWindowIndexes(database: Database, variant: keyof typeof INDEXES) {
  const definitions = {
    [START_INDEX]: "started_at",
    [END_INDEX]: "ended_at",
  };
  for (const name of Object.keys(definitions)) {
    await database.executeScript(`DROP INDEX IF EXISTS ${name}`);
  }
  // Match the creation order and definitions of the original migration when both are present.
  for (const name of INDEXES[variant]) {
    await database.executeScript(
      `CREATE INDEX ${name} ON time_entries (space_id, ${definitions[name]}) WHERE deleted_at IS NULL`,
    );
  }
}

function trackingClient(database: Database, sources: ReturnType<typeof createTestContext>) {
  return createRouterClient(createFrame(timeTracking, { database, sources, checkOutputs: false }));
}

/** Seed through the real Operations, outside the timed section. */
export async function withTimeTrackingFixture<Result>(
  run: (fixture: {
    database: Database;
    client: ReturnType<typeof trackingClient>;
    windowStatement: (span: (typeof SPANS)[keyof typeof SPANS]) => Promise<CompiledQuery>;
  }) => Promise<Result>,
  entryCount = ENTRY_COUNT,
) {
  const database = await createTestDatabase(timeTracking, [projects]);
  try {
    // The test context supplies a fixed Clock, deterministic ids and Europe/Berlin as device zone.
    const sources = createTestContext("2026-11-23T12:00:00.000Z");
    const client = trackingClient(database, sources);
    const projectsClient = createRouterClient(
      createFrame(projects, { database, sources, checkOutputs: false }),
    );
    const projectIds = [];
    for (const title of ["Website", "Research", "Support"]) {
      projectIds.push((await projectsClient.create({ title })).id);
    }

    let seed = 345;
    const next = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed;
    };
    for (let index = 0; index < entryCount; index++) {
      const start =
        FIRST_DAY +
        Math.floor(index / 11) * DAY_MS +
        (index % 11) * 2 * HOUR_MS +
        (next() % 7_200) * 1_000;
      const end = start + (60 + (next() % 14_400)) * 1_000;
      await client.create({
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(end).toISOString(),
        projects: [projectIds[index % 4]].flatMap((projectId) =>
          projectId === undefined ? [] : [{ projectId }],
        ),
        note: "Generated Time Entry",
      });
    }

    // Capture the real window with its bound parameters once per span, without timing the plugin.
    const windowStatement = async (span: (typeof SPANS)[keyof typeof SPANS]) => {
      let window: CompiledQuery | undefined;
      const kysely = database.kysely.withPlugin({
        transformQuery({ node, queryId }) {
          const statement = database.kysely.getExecutor().compileQuery(node, queryId);
          // The window is the first read of the entries; the stretches of entries across
          // midnight come after it.
          if (window === undefined && statement.sql.includes('from "time_entries"'))
            window = statement;
          return node;
        },
        async transformResult({ result }) {
          return result;
        },
      });
      await trackingClient({ ...database, kysely }, sources).days({ span });
      if (window === undefined) throw new Error("The Query did not read a Time Entry window");
      return window;
    };
    return await run({ database, client, windowStatement });
  } finally {
    await database.close();
  }
}

async function medianMilliseconds(call: () => Promise<unknown>): Promise<number> {
  for (let index = 0; index < 31; index++) await call();
  const samples: number[] = [];
  for (let index = 0; index < 101; index++) {
    const start = performance.now();
    await call();
    samples.push(performance.now() - start);
  }
  return samples.sort((a, b) => a - b)[50]!;
}

export async function measureTimeTracking() {
  return withTimeTrackingFixture(async ({ database, client, windowStatement }) => {
    const version = await sql<{ version: string }>`SELECT sqlite_version() AS version`.execute(
      database.kysely,
    );
    const measurements = [];
    for (const variant of ["both", "start", "end"] as const) {
      await setWindowIndexes(database, variant);
      for (const [range, span] of Object.entries(SPANS)) {
        const window = await windowStatement(span);
        const plan = await queryPlan(database, window);
        const rows = await database.kysely.executeQuery(window);
        measurements.push({
          variant,
          range,
          rows: rows.rows.length,
          windowMs: await medianMilliseconds(() => database.kysely.executeQuery(window)),
          queryMs: await medianMilliseconds(() => client.days({ span })),
          plan,
        });
      }
    }
    return { sqlite: version.rows[0]?.version, measurements };
  });
}
