import { describe, expect, it } from "vite-plus/test";
import {
  type ConnectionMark,
  FIRST_ANSWER_LIMIT_MS,
  type SmokeApp,
  smokeOptions,
  smokeTest,
} from "./desktop-smoke.ts";

/** One document of the page: its marks, as the app would set them over time. */
interface Script {
  readonly beforeKill: readonly ConnectionMark[];
  readonly afterKill: readonly ConnectionMark[];
  /** The page reloaded when the data process was killed. */
  readonly reloads?: boolean;
  /** What the page shows instead of the app, before and after the kill. */
  readonly failsToRender?: { readonly beforeKill?: string; readonly afterKill?: string };
  /** The marks after a Backup was restored; by default the data process starts anew. */
  readonly afterRestore?: readonly ConnectionMark[];
  /** The page reloaded when the Backup was restored. */
  readonly reloadsOnRestore?: boolean;
  /** What the page says instead of confirming the restore. */
  readonly restoreFails?: string;
  /** The Backups listed once the page is ready again; by default one more, of what was replaced. */
  readonly backupsAfterRestore?: number;
}

const START: readonly ConnectionMark[] = [
  { status: "connecting", at: 3 },
  { status: "ready", at: 180 },
];
const RECONNECT: readonly ConnectionMark[] = [
  { status: "reconnecting", at: 900 },
  { status: "ready", at: 1040 },
];
const RESTART: readonly ConnectionMark[] = [
  { status: "reconnecting", at: 2100 },
  { status: "ready", at: 2230 },
];

function fakeApp(script: Script): SmokeApp & { readonly calls: string[] } {
  const calls: string[] = [];
  let killed = false;
  let restored = false;
  // The daily Backup of the start.
  let backups = 1;
  return {
    calls,
    async waitForPage() {
      calls.push("window");
    },
    async waitForApp() {
      calls.push("app");
      const shown = killed ? script.failsToRender?.afterKill : script.failsToRender?.beforeKill;
      if (shown !== undefined) throw new Error(`The page did not show the app. It shows: ${shown}`);
    },
    async waitForSettled(count) {
      calls.push(`settled ${count}`);
      if (!killed) return { document: 1, marks: script.beforeKill };
      if (script.reloads) return { document: 2, marks: script.afterKill };
      const marks = [...script.beforeKill, ...script.afterKill];
      if (!restored) return { document: 1, marks };
      const afterRestore = script.afterRestore ?? RESTART;
      return script.reloadsOnRestore
        ? { document: 2, marks: afterRestore }
        : { document: 1, marks: [...marks, ...afterRestore] };
    },
    async killDataProcess() {
      calls.push("kill");
      killed = true;
    },
    async openBackups() {
      calls.push("open backups");
      return backups;
    },
    async takeBackup() {
      calls.push("take backup");
      backups += 1;
    },
    async restoreNewestBackup() {
      calls.push("restore");
      if (script.restoreFails !== undefined) {
        throw new Error(`The page did not confirm the restore. It says: ${script.restoreFails}`);
      }
      restored = true;
      backups = script.backupsAfterRestore ?? backups + 1;
    },
    async waitForBackups(count) {
      calls.push(`backups ${count}`);
      if (backups !== count) {
        throw new Error(`The settings list ${backups} Backups; ${count} were expected.`);
      }
    },
  };
}

describe("smokeTest", () => {
  it("waits for the window, the first answer and the app, kills the data process and waits again, then restores a Backup and waits once more", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: RECONNECT });
    expect(await smokeTest(app)).toEqual({ firstAnswerMs: 180 });
    expect(app.calls).toEqual([
      "window",
      "settled 1",
      "app",
      "kill",
      "settled 2",
      "app",
      "open backups",
      "take backup",
      "backups 2",
      "restore",
      "settled 3",
      "app",
      "backups 3",
    ]);
  });

  it("fails a start whose page shows an error instead of the app, even with a ready connection", async () => {
    const app = fakeApp({
      beforeKill: START,
      afterKill: RECONNECT,
      failsToRender: { beforeKill: "Something went wrong!" },
    });
    await expect(smokeTest(app)).rejects.toThrow("It shows: Something went wrong!");
    expect(app.calls).not.toContain("kill");
  });

  it("fails when the page no longer shows the app after reconnecting", async () => {
    const app = fakeApp({
      beforeKill: START,
      afterKill: RECONNECT,
      failsToRender: { afterKill: "Something went wrong!" },
    });
    await expect(smokeTest(app)).rejects.toThrow("It shows: Something went wrong!");
  });

  it("fails a first answer after the limit, naming the limit and the measured time", async () => {
    const app = fakeApp({
      beforeKill: [
        { status: "connecting", at: 3 },
        { status: "ready", at: 2345.6 },
      ],
      afterKill: RECONNECT,
    });
    await expect(smokeTest(app)).rejects.toThrow(
      "The first answer from the data process came after 2346 ms; the limit is 2000 ms.",
    );
    expect(FIRST_ANSWER_LIMIT_MS).toBe(2000);
  });

  it("fails a start that settles in another state than ready", async () => {
    const app = fakeApp({
      beforeKill: [
        { status: "connecting", at: 3 },
        { status: "migrationFailed", at: 200 },
      ],
      afterKill: [],
    });
    await expect(smokeTest(app)).rejects.toThrow(
      'The data connection settled as "migrationFailed" instead of "ready".',
    );
    expect(app.calls).not.toContain("kill");
  });

  it("fails when the app is not ready again after the data process was killed", async () => {
    const app = fakeApp({
      beforeKill: START,
      afterKill: [
        { status: "reconnecting", at: 900 },
        { status: "stopped", at: 1200 },
      ],
    });
    await expect(smokeTest(app)).rejects.toThrow(
      'After the data process was killed, the data connection settled as "stopped" instead of "ready".',
    );
  });

  it("fails when the app never noticed that the data process was gone", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: [{ status: "ready", at: 1040 }] });
    await expect(smokeTest(app)).rejects.toThrow(
      "After the data process was killed, the data connection never reconnected.",
    );
  });

  it("fails when the page reloaded to get ready again", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: START, reloads: true });
    await expect(smokeTest(app)).rejects.toThrow(
      "The page reloaded after the data process was killed; it must reconnect without a reload.",
    );
  });

  it("fails when the page does not confirm the restore, naming what it says instead", async () => {
    const app = fakeApp({
      beforeKill: START,
      afterKill: RECONNECT,
      restoreFails: "Something went wrong, and the change was not saved.",
    });
    await expect(smokeTest(app)).rejects.toThrow(
      "It says: Something went wrong, and the change was not saved.",
    );
    expect(app.calls).not.toContain("settled 3");
  });

  it("fails when the data process did not start anew after the restore", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: RECONNECT, afterRestore: [] });
    await expect(smokeTest(app)).rejects.toThrow(
      "After a Backup was restored, the data process did not start anew.",
    );
  });

  it("fails when the app is not ready again after the restore", async () => {
    const app = fakeApp({
      beforeKill: START,
      afterKill: RECONNECT,
      afterRestore: [
        { status: "reconnecting", at: 2100 },
        { status: "migrationFailed", at: 2300 },
      ],
    });
    await expect(smokeTest(app)).rejects.toThrow(
      'After a Backup was restored, the data connection settled as "migrationFailed" instead of "ready".',
    );
  });

  it("fails when the page reloaded to get ready again after the restore", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: RECONNECT, reloadsOnRestore: true });
    await expect(smokeTest(app)).rejects.toThrow(
      "The page reloaded after a Backup was restored; it must reconnect without one.",
    );
  });

  it("fails when the Backup of what the restore replaced is not listed afterwards", async () => {
    const app = fakeApp({ beforeKill: START, afterKill: RECONNECT, backupsAfterRestore: 2 });
    await expect(smokeTest(app)).rejects.toThrow("The settings list 2 Backups; 3 were expected.");
  });
});

describe("smokeOptions", () => {
  it("tests the built app by default", () => {
    expect(smokeOptions([])).toEqual({ executable: undefined });
  });

  it("tests the executable it is given, such as a packaged app", () => {
    expect(
      smokeOptions(["--executable", "/Applications/Self-Engine.app/Contents/MacOS/Self-Engine"]),
    ).toEqual({
      executable: "/Applications/Self-Engine.app/Contents/MacOS/Self-Engine",
    });
  });

  it("rejects an unknown option before starting anything", () => {
    expect(() => smokeOptions(["--executabel", "/x"])).toThrow();
  });
});
