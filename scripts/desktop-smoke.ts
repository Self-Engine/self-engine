// The `smoke` stage of `pnpm verify` (spec #29, testing seam 3): starts the built desktop app with
// a throwaway data folder and checks what a broken start would break. The page loads, the
// data connection gets ready (the data process only answers when its `health` is ready), the
// first answer comes within FIRST_ANSWER_LIMIT_MS, the page shows the app, and after the data
// process is killed the page is ready again without a reload and still shows the app. Then a
// Backup is taken and restored in the settings (D94): the page gets its answer, the data process
// starts anew on the restored database, and the page is ready again and lists the Backup of what
// the restore replaced.
//
// The checks run against `SmokeApp`, so the packaged app (#146) runs the same ones through
// desktop-app.ts with another executable: `node scripts/desktop-smoke.ts --executable <path>`.
// Run alone, the default needs `vp run -r build` first; `pnpm verify` builds before this stage.

import { parseArgs } from "node:util";
import { CONNECTION_MARK } from "@self-engine/desktop-bridge";
import type { ElectronApplication, Page } from "playwright";
import {
  builtDesktopApp,
  type DesktopLaunch,
  launchElectron,
  RENDERER_DIR,
  serveRenderer,
  withDesktopApp,
  waitForApp,
  DESKTOP_HIDDEN_ENV,
} from "./desktop-app.ts";
import { DESKTOP_DIR } from "./ensure-electron.ts";

/** Loose on purpose (spec #29): measured 253 ms, so only a regression by a multiple fails. */
export const FIRST_ANSWER_LIMIT_MS = 2000;

/**
 * One state of the page's data connection, as the page marks it (apps/web/src/desktop-data.ts,
 * `markConnectionStates`): `at` is milliseconds since the window's page started loading.
 */
export interface ConnectionMark {
  readonly status: string;
  readonly at: number;
}

/** The marks of one page document; `document` changes when the page reloads. */
export interface PageMarks {
  readonly document: number;
  readonly marks: readonly ConnectionMark[];
}

/** The running app, as the smoke test drives it. */
export interface SmokeApp {
  /** Waits until the app has a page, even when its native window stays hidden. */
  waitForPage(): Promise<void>;
  /**
   * Waits until the page shows the app: the Shell's main landmark, which a render error replaces
   * with an error page. Fails naming what the page shows instead.
   */
  waitForApp(): Promise<void>;
  /** Waits until the page's connection has settled `count` times, then reads its marks. */
  waitForSettled(count: number): Promise<PageMarks>;
  /** Kills the data process the way a crash would. */
  killDataProcess(): Promise<void>;
  /** Opens the View Data of the settings and counts the Backups it lists, once it has loaded. */
  openBackups(): Promise<number>;
  /** Presses "Create backup now". */
  takeBackup(): Promise<void>;
  /**
   * Restores the newest Backup listed. Resolves once the page offers to take the restore back,
   * which it does only after the restore answered; fails naming what the page says instead.
   */
  restoreNewestBackup(): Promise<void>;
  /** Waits until the View Data lists `count` Backups; fails naming how many it lists. */
  waitForBackups(count: number): Promise<void>;
}

export interface SmokeResult {
  readonly firstAnswerMs: number;
}

const WAITING_STATES: ReadonlySet<string> = new Set(["connecting", "reconnecting"]);

/** Whether the connection has stopped waiting: ready, or one of its failure states. */
export function isSettled(mark: ConnectionMark): boolean {
  return !WAITING_STATES.has(mark.status);
}

export async function smokeTest(app: SmokeApp): Promise<SmokeResult> {
  await app.waitForPage();

  const start = await app.waitForSettled(1);
  const first = start.marks.find(isSettled);
  if (first?.status !== "ready") {
    throw new Error(`The data connection settled as "${first?.status}" instead of "ready".`);
  }
  if (first.at > FIRST_ANSWER_LIMIT_MS) {
    throw new Error(
      `The first answer from the data process came after ${Math.round(first.at)} ms; the limit is ${FIRST_ANSWER_LIMIT_MS} ms.`,
    );
  }
  await app.waitForApp();

  await app.killDataProcess();
  const after = await app.waitForSettled(2);
  if (after.document !== start.document) {
    throw new Error(
      "The page reloaded after the data process was killed; it must reconnect without a reload.",
    );
  }
  const later = after.marks.slice(start.marks.indexOf(first) + 1);
  if (!later.some((mark) => mark.status === "reconnecting")) {
    throw new Error("After the data process was killed, the data connection never reconnected.");
  }
  const again = later.find(isSettled);
  if (again?.status !== "ready") {
    throw new Error(
      `After the data process was killed, the data connection settled as "${again?.status}" instead of "ready".`,
    );
  }
  await app.waitForApp();

  // A restore ends with the data process starting anew, on its own request (D94).
  const backups = await app.openBackups();
  await app.takeBackup();
  await app.waitForBackups(backups + 1);
  await app.restoreNewestBackup();
  const restored = await app.waitForSettled(3);
  if (restored.document !== start.document) {
    throw new Error(
      "The page reloaded after a Backup was restored; it must reconnect without one.",
    );
  }
  const sinceRestore = restored.marks.slice(after.marks.indexOf(again) + 1);
  if (!sinceRestore.some((mark) => mark.status === "reconnecting")) {
    throw new Error("After a Backup was restored, the data process did not start anew.");
  }
  const anew = sinceRestore.find(isSettled);
  if (anew?.status !== "ready") {
    throw new Error(
      `After a Backup was restored, the data connection settled as "${anew?.status}" instead of "ready".`,
    );
  }
  await app.waitForApp();
  // What the restore replaced is a Backup of its own, and the reconnect reloaded the list (D250).
  await app.waitForBackups(backups + 2);
  return { firstAnswerMs: first.at };
}

/** `--executable <path>` tests that executable, a packaged app; without it, the built app. */
export function smokeOptions(args: readonly string[]): { executable: string | undefined } {
  const { values } = parseArgs({
    args: [...args],
    options: { executable: { type: "string" } },
    strict: true,
  });
  return { executable: values.executable };
}

const WAIT_TIMEOUT_MS = 30_000;

/**
 * Drives the app through Playwright. The waits are generous: a slow machine shows up as a
 * measured time, which the checks judge, not as a timeout.
 */
export function smokeDriver(app: ElectronApplication): SmokeApp {
  const page = app.firstWindow({ timeout: WAIT_TIMEOUT_MS });
  return {
    async waitForPage() {
      await page;
    },
    async waitForApp() {
      await waitForApp(await page);
    },
    async waitForSettled(count) {
      const target = await page;
      const waiting = [...WAITING_STATES];
      await target
        .waitForFunction(
          ({ name, waiting, count }) =>
            performance
              .getEntriesByName(name)
              .filter(
                (entry) => !waiting.includes(String("detail" in entry ? entry.detail : undefined)),
              ).length >= count,
          { name: CONNECTION_MARK, waiting, count },
          { timeout: WAIT_TIMEOUT_MS },
        )
        .catch((error: unknown) => {
          throw new Error(
            `The data connection did not settle ${count === 1 ? "once" : `${count} times`} within ${WAIT_TIMEOUT_MS} ms.`,
            { cause: error },
          );
        });
      return target.evaluate(
        (name) => ({
          document: performance.timeOrigin,
          marks: performance.getEntriesByName(name).map((entry) => ({
            status: String("detail" in entry ? entry.detail : undefined),
            at: entry.startTime,
          })),
        }),
        CONNECTION_MARK,
      );
    },
    async killDataProcess() {
      const pid = await app.evaluate(
        ({ app: electronApp }) =>
          electronApp
            .getAppMetrics()
            .find(
              (metric) =>
                metric.type === "Utility" && metric.name === `${electronApp.getName()} Data`,
            )?.pid,
      );
      if (pid === undefined) throw new Error("The app runs no data process to kill.");
      process.kill(pid, "SIGKILL");
    },
    // The View Data is found by its structure, not its texts, so the checks pass in any App
    // Language: its rows are groups, and the one with the list restores (backup-rows.tsx).
    async openBackups() {
      const target = await page;
      await target.evaluate(() => {
        window.location.hash = "/settings/data";
      });
      const { lines } = backupRows(target);
      await lines.first().waitFor({ timeout: WAIT_TIMEOUT_MS });
      return lines.count();
    },
    async takeBackup() {
      await backupRows(await page).take.click();
    },
    async restoreNewestBackup() {
      const target = await page;
      await backupRows(target).lines.first().getByRole("button").click();
      // Only the Notice of a restore that answered has a second button, its Undo; a failure's
      // has the close button alone.
      const notices = target.locator(".mantine-Notification-root");
      const undoable = notices.filter({
        has: target.locator("button:not(.mantine-Notification-closeButton)"),
      });
      await undoable.waitFor({ timeout: WAIT_TIMEOUT_MS }).catch(async (error: unknown) => {
        const said = (await notices.allInnerTexts()).join(" | ");
        throw new Error(
          `The page did not confirm the restore within ${WAIT_TIMEOUT_MS} ms. It says: ${said || "nothing"}`,
          { cause: error },
        );
      });
    },
    async waitForBackups(count) {
      const { lines } = backupRows(await page);
      await lines
        .nth(count - 1)
        .waitFor({ timeout: WAIT_TIMEOUT_MS })
        .catch(async (error: unknown) => {
          throw new Error(
            `The settings list ${await lines.count()} Backups; ${count} were expected within ${WAIT_TIMEOUT_MS} ms.`,
            { cause: error },
          );
        });
    },
  };
}

/** The two rows of the View Data: the button that takes a Backup, and the lines of the list. */
function backupRows(page: Page) {
  const rows = page.getByRole("group");
  const list = page.getByRole("list");
  return {
    take: rows.filter({ hasNot: list }).getByRole("button"),
    lines: rows.filter({ has: list }).getByRole("listitem"),
  };
}

/** Starts `launch` with a throwaway data folder and runs the checks on it. */
export function smokeTestApp(launch: DesktopLaunch): Promise<SmokeResult> {
  return withDesktopApp(launch, (app) => smokeTest(smokeDriver(app)), launchElectron);
}

async function main(): Promise<void> {
  const { executable } = smokeOptions(process.argv.slice(2));
  let result: SmokeResult;
  if (executable !== undefined) {
    result = await smokeTestApp({ executablePath: executable, args: [], env: {} });
  } else {
    const server = await serveRenderer(RENDERER_DIR);
    try {
      const launch = builtDesktopApp(DESKTOP_DIR, server.url);
      result = await smokeTestApp({
        ...launch,
        env: { ...launch.env, [DESKTOP_HIDDEN_ENV]: "1" },
      });
    } finally {
      await server.close();
    }
  }
  console.log(
    `Desktop smoke test passed: first answer after ${Math.round(result.firstAnswerMs)} ms (limit ${FIRST_ANSWER_LIMIT_MS} ms), ready again after the data process was killed and after a Backup was restored.`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
