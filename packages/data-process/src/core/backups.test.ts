// The core answers the protocol's `backups` from the Backups its platform passes in (D94), over
// Node's MessageChannel. The Backups themselves are tested in `@self-engine/backup`.

import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { Backup, ProtocolContract } from "@self-engine/data-protocol";
import type { FrameReport } from "@self-engine/storage";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";
import type { BackupService } from "./index.ts";

const DAILY: Backup = {
  id: "2026-11-13T12-00-00-000Z-daily",
  takenAt: "2026-11-13T12:00:00.000Z",
  kind: "daily",
  sizeBytes: 4096,
};
const MANUAL: Backup = {
  id: "2026-11-13T12-30-00-000Z-manual",
  takenAt: "2026-11-13T12:30:00.000Z",
  kind: "manual",
  sizeBytes: 4096,
};
const BEFORE_RESTORE: Backup = {
  id: "2026-11-13T13-00-00-000Z-before-restore",
  takenAt: "2026-11-13T13:00:00.000Z",
  kind: "before-restore",
  sizeBytes: 8192,
};

const started: TestDataProcess[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
});

/** The platform's Backups as the test fixes them; what is left out fails like a full disk. */
function service(parts: Partial<BackupService> = {}): BackupService {
  const full = () => Promise.reject(new Error("The disk is full"));
  return {
    list: full,
    create: full,
    restore: full,
    automaticBackupFailed: () => false,
    ...parts,
  };
}

/** Starts the core on these Backups of its platform, or on a platform that keeps none. */
async function start(backups?: BackupService, afterReport: () => void = () => {}) {
  const reports: FrameReport[] = [];
  let restarts = 0;
  let restarted = () => {};
  const restart = new Promise<void>((resolve) => {
    restarted = resolve;
  });
  const dataProcess = await startTestDataProcess({
    report: (report) => {
      reports.push(report);
      afterReport();
    },
    ...(backups && {
      backups: {
        service: backups,
        restart: () => {
          restarts += 1;
          restarted();
        },
      },
    }),
  });
  started.push(dataProcess);
  const client: ContractRouterClient<ProtocolContract> = createORPCClient(
    new RPCLink({ port: dataProcess.openPort() }),
  );
  return { client, reports, restart, restarts: () => restarts };
}

/** A turn of the event loop after the timers: a restart that was asked for has happened by now. */
const afterTimers = () => new Promise<void>((resolve) => setTimeout(() => setImmediate(resolve)));

test("the list and a new Backup come from the platform's Backups", async () => {
  const { client } = await start(
    service({
      list: () => Promise.resolve([MANUAL, DAILY]),
      create: () => Promise.resolve(MANUAL),
    }),
  );

  await expect(client.backups.list({})).resolves.toEqual({
    backups: [MANUAL, DAILY],
    automaticBackupFailed: false,
  });
  await expect(client.backups.create({})).resolves.toEqual(MANUAL);
});

test("the list says so while the platform's automatic Backups fail", async () => {
  let failed = true;
  const { client } = await start(
    service({ list: () => Promise.resolve([DAILY]), automaticBackupFailed: () => failed }),
  );

  await expect(client.backups.list({})).resolves.toEqual({
    backups: [DAILY],
    automaticBackupFailed: true,
  });
  failed = false;
  await expect(client.backups.list({})).resolves.toMatchObject({ automaticBackupFailed: false });
});

test("a restore answers with the Backup of what it replaces, then asks for the restart", async () => {
  const restored: string[] = [];
  const { client, restart, restarts } = await start(
    service({
      restore: (id) => {
        restored.push(id);
        return Promise.resolve({ status: "restored", replaced: BEFORE_RESTORE });
      },
    }),
  );

  await expect(client.backups.restore({ id: DAILY.id })).resolves.toEqual(BEFORE_RESTORE);
  await restart;

  expect(restored).toEqual([DAILY.id]);
  expect(restarts()).toBe(1);
});

test("the restart is not asked for before the restore has its answer", async () => {
  let restartsWhenStaged = -1;
  const { client, restart, restarts } = await start(
    service({
      restore: async () => {
        await Promise.resolve();
        restartsWhenStaged = restarts();
        return { status: "restored", replaced: BEFORE_RESTORE };
      },
    }),
  );

  await client.backups.restore({ id: DAILY.id });
  await restart;

  expect(restartsWhenStaged).toBe(0);
});

test("a Backup that is gone is `not found`, and nothing restarts", async () => {
  const { client, restarts } = await start(
    service({ restore: () => Promise.resolve({ status: "notFound" }) }),
  );

  await expect(client.backups.restore({ id: DAILY.id })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await afterTimers();

  expect(restarts()).toBe(0);
});

test("a Backup that cannot be read is a conflict with its reason, and nothing restarts", async () => {
  const { client, reports, restarts } = await start(
    service({ restore: () => Promise.resolve({ status: "unreadable" }) }),
  );

  const error = await client.backups.restore({ id: DAILY.id }).catch((thrown: unknown) => thrown);
  await afterTimers();

  expect(error).toBeInstanceOf(ORPCError);
  expect(error).toMatchObject({ code: "CONFLICT", data: { reason: "backup_unreadable" } });
  expect(restarts()).toBe(0);
  // Both are expected: neither goes to the error log.
  expect(reports).toEqual([]);
});

test("a Backup that fails is reported with its entry, and the call fails", async () => {
  const { client, reports } = await start(service());

  await expect(client.backups.create({})).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });

  expect(reports).toEqual([
    {
      kind: "unexpected-error",
      entry: "backups.create",
      error: expect.objectContaining({ message: "The disk is full" }),
    },
  ]);
});

test("a Backup that fails is the same failed call when the reporter throws", async () => {
  const { client, reports } = await start(service(), () => {
    throw new Error("Reporter failed");
  });

  await expect(client.backups.create({})).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });

  expect(reports).toMatchObject([{ entry: "backups.create" }]);
});

test("without Backups from the platform every Backup call fails and says so", async () => {
  const { client, reports } = await start();

  await expect(client.backups.list({})).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

  expect(reports).toMatchObject([
    { entry: "backups.list", error: { message: "This Data Process keeps no Backups" } },
  ]);
});

test("the opening event calls the list of Backups a Query that reads no table", async () => {
  const { client } = await start(service());
  const stopped = new AbortController();

  const stream = await client.tablesChanged(undefined, { signal: stopped.signal });
  const { value: opening } = await stream[Symbol.asyncIterator]().next();
  stopped.abort();

  expect(opening).toMatchObject({ kind: "opened", queries: { backups: { list: [] } } });
});

test("Backups come with their restart: the type refuses one without the other", () => {
  // @ts-expect-error A restore that is staged without a restart would lose every later write.
  void (() => startTestDataProcess({ backups: { service: service() } }));
  // @ts-expect-error A restart alone restores nothing.
  void (() => startTestDataProcess({ backups: { restart: () => undefined } }));
  // @ts-expect-error The restart is part of `backups`, not an option of its own.
  void (() => startTestDataProcess({ restart: () => undefined }));
});
